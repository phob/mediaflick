using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Logging;
using System.Collections.Concurrent;
using PlexLocalScan.Shared.Options;
using PlexLocalScan.Data.Data;
using PlexLocalScan.Shared.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PlexLocalScan.Core.Tables;
using PlexLocalScan.FileTracking.Services;

namespace PlexLocalScan.Shared.Services;

public class FilePollerService(
    ILogger<FilePollerService> logger,
    IPlexHandler plexHandler,
    IServiceScopeFactory serviceScopeFactory,
    IOptions<PlexOptions> options) : BackgroundService
{
    private readonly ConcurrentDictionary<string, HashSet<string>> _knownFolders = new();
    private readonly PlexOptions _plexOptions = options.Value;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("FilePollerService started");
        // Initialize known folders dictionary
        foreach (FolderMappingOptions mapping in _plexOptions.FolderMappings)
        {
            logger.LogInformation("Watching folder: {SourceFolder} with Type: {MediaType}", mapping.SourceFolder, mapping.MediaType);
            if (Directory.Exists(mapping.SourceFolder))
            {
                _knownFolders[mapping.SourceFolder] = [.. Directory.GetDirectories(mapping.SourceFolder)];
            }
        }

        foreach (FolderMappingOptions mapping in _plexOptions.FolderMappings)
        {
            logger.LogInformation("Watching folder: {SourceFolder} with Type: {MediaType}", mapping.SourceFolder, mapping.MediaType);
        }
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessAllMappingsAsync(stoppingToken);
                await Task.Delay(TimeSpan.FromSeconds(_plexOptions.PollingInterval), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                // Graceful shutdown, no need to log an error
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error occurred while monitoring folders");
                try
                {
                    await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    // Graceful shutdown during error recovery
                    break;
                }
            }
        }

        logger.LogInformation("FilePollerService shutting down");
    }

    private async Task ProcessAllMappingsAsync(CancellationToken stoppingToken)
    {
        using IServiceScope scope = serviceScopeFactory.CreateScope();
        PlexScanContext dbContext = scope.ServiceProvider.GetRequiredService<PlexScanContext>();
        ICleanupHandler cleanupHandler = scope.ServiceProvider.GetRequiredService<ICleanupHandler>();
        
        // Create a list to store all files that need to be deleted from the database
        var filesToDelete = new List<ScannedFile>();
        
        foreach (FolderMappingOptions folderMapping in _plexOptions.FolderMappings)
        {
            string folderMappingSourcePath = Path.GetFullPath(folderMapping.SourceFolder);

            if (!Directory.Exists(folderMappingSourcePath))
            {
                logger.LogWarning("Source folder no longer exists: {SourceFolder}", folderMappingSourcePath);
                await cleanupHandler.CleanupDeletedSourceFolderAsync(folderMappingSourcePath);
                continue;
            }

            var currentSourceSubFolders = new HashSet<string>(Directory.GetDirectories(folderMappingSourcePath));
            
            // Check for deleted folders
            if (_knownFolders.TryGetValue(folderMapping.SourceFolder, out HashSet<string>? previousFolders))
            {
                var deletedFolders = previousFolders.Except(currentSourceSubFolders).ToList();
                foreach (string deletedFolder in deletedFolders)
                {
                    logger.LogInformation("Folder was deleted: {FolderPath}", deletedFolder);
                    await cleanupHandler.CleanupDeletedSourceFolderAsync(deletedFolder);
                }
            }

            // Get all tracked files for this source folder - optimize by selecting only necessary fields
            var filesAlreadyInDb = await dbContext.ScannedFiles
                .Where(f => f.SourceFile.StartsWith(folderMappingSourcePath))
                .Select(f => new { f.SourceFile, f.DestFile, f.Id })
                .ToListAsync(stoppingToken);

            var filePathsAlreadyInDb = new HashSet<string>(filesAlreadyInDb.Select(f => f.SourceFile));

            // Check for deleted files in batch
            var deletedFiles = filesAlreadyInDb.Where(trackedFile => !File.Exists(trackedFile.SourceFile)).ToList();
            foreach (var trackedFile in deletedFiles)
            {
                logger.LogInformation("Source file was deleted: {SourceFile}", trackedFile.SourceFile);
                    
                // Delete destination file if it exists
                if (!string.IsNullOrEmpty(trackedFile.DestFile) && File.Exists(trackedFile.DestFile))
                {
                    try
                    {
                        File.Delete(trackedFile.DestFile);
                        logger.LogInformation("Deleted destination file: {DestFile}", trackedFile.DestFile);
                    }
                    catch (Exception ex)
                    {
                        logger.LogError(ex, "Error deleting destination file: {DestFile}", trackedFile.DestFile);
                    }
                }

                // Add to the list of files to delete from database
                filesToDelete.Add(new ScannedFile { Id = trackedFile.Id });
            }

            // Scan for untracked files
            await ScanForUntrackedFilesAsync(
                folderMappingSourcePath, 
                filePathsAlreadyInDb, 
                folderMapping, 
                stoppingToken);

            // Clean up empty directories in destination folder
            if (Directory.Exists(folderMapping.DestinationFolder))
            {
                await cleanupHandler.CleanupDeadSymlinksAsync(folderMapping.DestinationFolder);
            }

            // Update known folders for future reference
            _knownFolders[folderMapping.SourceFolder] = [..currentSourceSubFolders];
        }

        // Batch delete files from database
        if (filesToDelete.Count != 0)
        {
            dbContext.ScannedFiles.RemoveRange(filesToDelete);
            await dbContext.SaveChangesAsync(stoppingToken);
        }
    }

    private async Task ProcessSingleFileAsync(string file, string destinationFolder, FolderMappingOptions mapping)
    {
        try 
        {
            using IServiceScope scope = serviceScopeFactory.CreateScope();
            IContextService contextService = scope.ServiceProvider.GetRequiredService<IContextService>();
            IMediaDetectionService mediaDetectionService = scope.ServiceProvider.GetRequiredService<IMediaDetectionService>();
            ISymlinkHandler symlinkHandler = scope.ServiceProvider.GetRequiredService<ISymlinkHandler>();

            ScannedFile? trackedFile = await contextService.AddStatusAsync(file, null, mapping.MediaType);
            if (trackedFile == null)
            {
                return;
            }

            Core.Media.MediaInfo? mediaInfo = await mediaDetectionService.DetectMediaAsync(file, mapping.MediaType);
            
            if (await symlinkHandler.CreateSymlinksAsync(file, destinationFolder, mediaInfo, mapping.MediaType))
            {
                _ = await contextService.UpdateStatusAsync(file, null, mediaInfo, FileStatus.Success);
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error processing file: {File}", file);
        }
    }

    private async Task ScanForUntrackedFilesAsync(
        string sourceFolder,
        HashSet<string> trackedFiles,
        FolderMappingOptions mapping,
        CancellationToken stoppingToken)
    {
        try
        {
            // Get all files in the source folder recursively
            IEnumerable<string> allFiles = Directory.EnumerateFiles(sourceFolder, "*.*", SearchOption.AllDirectories);
            
            // Process files in batches to avoid memory pressure
            const int batchSize = 100;
            var untrackedFiles = allFiles
                .Where(file => !trackedFiles.Contains(file))
                .Select(file => new { File = file, Folder = Path.GetDirectoryName(file)! })
                .GroupBy(x => x.Folder);

            foreach (var folderGroup in untrackedFiles)
            {
                logger.LogInformation("Processing untracked files in folder: {Folder}", folderGroup.Key);
                string destinationFolder = Path.Combine(mapping.DestinationFolder);
                IEnumerable<string> files = folderGroup.Select(x => x.File);

                foreach (string[] batch in files.Chunk(batchSize))
                {
                    foreach (string? file in batch)
                    {
                        await ProcessSingleFileAsync(file, destinationFolder, mapping);
                    }
                    await Task.Delay(100, stoppingToken); // Small delay between batches
                }

                // Trigger Plex scan after processing each folder
                await plexHandler.AddFolderForScanningAsync(destinationFolder, mapping.DestinationFolder);
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error scanning for untracked files in folder: {Folder}", sourceFolder);
        }
    }

    public override Task StopAsync(CancellationToken cancellationToken)
    {
        logger.LogInformation("FilePollerService stopping, clearing known folders");
        _knownFolders.Clear();
        return base.StopAsync(cancellationToken);
    }
}
