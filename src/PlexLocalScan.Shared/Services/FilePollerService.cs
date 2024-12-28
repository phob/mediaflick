using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Logging;
using System.Collections.Concurrent;
using PlexLocalScan.Shared.Options;
using PlexLocalScan.Data.Models;
using PlexLocalScan.Data.Data;
using PlexLocalScan.Shared.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace PlexLocalScan.Shared.Services;

public class FilePollerService : BackgroundService
{
    private readonly ILogger<FilePollerService> _logger;
    private readonly IPlexHandler _plexHandler;
    private readonly PlexOptions _options;
    private readonly ConcurrentDictionary<string, HashSet<string>> _knownFolders = new();
    private readonly IServiceScopeFactory _serviceScopeFactory;

    public FilePollerService(
        ILogger<FilePollerService> logger,
        IPlexHandler plexHandler,
        IServiceScopeFactory serviceScopeFactory,
        IOptions<PlexOptions> options)
    {
        _logger = logger;
        _plexHandler = plexHandler;
        _options = options.Value;
        _serviceScopeFactory = serviceScopeFactory;
        
        // Initialize known folders dictionary
        foreach (var mapping in _options.FolderMappings)
        {
            _knownFolders[mapping.SourceFolder] = [.. Directory.GetDirectories(mapping.SourceFolder)];
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("FilePollerService started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessAllMappingsAsync(stoppingToken);
                await Task.Delay(TimeSpan.FromSeconds(_options.PollingInterval), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                // Graceful shutdown, no need to log an error
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while monitoring folders");
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

        _logger.LogInformation("FilePollerService shutting down");
    }

    private async Task ProcessAllMappingsAsync(CancellationToken stoppingToken)
    {
        using var scope = _serviceScopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<PlexScanContext>();
        var cleanupHandler = scope.ServiceProvider.GetRequiredService<ICleanupHandler>();
        
        // Create a list to store all files that need to be deleted from the database
        var filesToDelete = new List<ScannedFile>();
        
        foreach (var mapping in _options.FolderMappings)
        {
            var fullSourcePath = Path.GetFullPath(mapping.SourceFolder);

            if (!Directory.Exists(fullSourcePath))
            {
                _logger.LogWarning("Source folder no longer exists: {SourceFolder}", fullSourcePath);
                await cleanupHandler.CleanupDeletedSourceFolderAsync(fullSourcePath);
                continue;
            }

            var currentFolders = new HashSet<string>(Directory.GetDirectories(fullSourcePath));
            
            // Check for deleted folders
            if (_knownFolders.TryGetValue(mapping.SourceFolder, out var previousFolders))
            {
                var deletedFolders = previousFolders.Except(currentFolders).ToList();
                foreach (var deletedFolder in deletedFolders)
                {
                    _logger.LogInformation("Folder was deleted: {FolderPath}", deletedFolder);
                    await cleanupHandler.CleanupDeletedSourceFolderAsync(deletedFolder);
                }
            }

            // Get all tracked files for this source folder - optimize by selecting only necessary fields
            var trackedFiles = await dbContext.ScannedFiles
                .Where(f => f.SourceFile.StartsWith(fullSourcePath))
                .Select(f => new { f.SourceFile, f.DestFile, f.Id })
                .ToListAsync(stoppingToken);

            var trackedFilePaths = new HashSet<string>(trackedFiles.Select(f => f.SourceFile));

            // Check for deleted files in batch
            var deletedFiles = trackedFiles.Where(trackedFile => !File.Exists(trackedFile.SourceFile)).ToList();
            foreach (var trackedFile in deletedFiles)
            {
                _logger.LogInformation("Source file was deleted: {SourceFile}", trackedFile.SourceFile);
                    
                // Delete destination file if it exists
                if (!string.IsNullOrEmpty(trackedFile.DestFile) && File.Exists(trackedFile.DestFile))
                {
                    try
                    {
                        File.Delete(trackedFile.DestFile);
                        _logger.LogInformation("Deleted destination file: {DestFile}", trackedFile.DestFile);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error deleting destination file: {DestFile}", trackedFile.DestFile);
                    }
                }

                // Add to the list of files to delete from database
                filesToDelete.Add(new ScannedFile { Id = trackedFile.Id });
            }

            // Process new folders
            var processedFolders = new HashSet<string>(
                trackedFiles.Select(f => Path.GetDirectoryName(f.SourceFile)!)
            );

            var foldersToProcess = currentFolders
                .Where(folder => !processedFolders.Contains(folder));

            // Process folders in parallel with a maximum degree of parallelism
            await Parallel.ForEachAsync(
                foldersToProcess,
                new ParallelOptions 
                { 
                    MaxDegreeOfParallelism = 3,
                    CancellationToken = stoppingToken 
                },
                async (folder, ct) => await ProcessNewFolderAsync(folder, mapping, ct)
            );

            // Scan for untracked files
            await ScanForUntrackedFilesAsync(
                fullSourcePath, 
                trackedFilePaths, 
                mapping, 
                stoppingToken);

            // Clean up empty directories in destination folder
            if (Directory.Exists(mapping.DestinationFolder))
            {
                await cleanupHandler.CleanupDeadSymlinksAsync(mapping.DestinationFolder);
            }

            // Update known folders for future reference
            _knownFolders[mapping.SourceFolder] = [..currentFolders];
        }

        // Batch delete files from database
        if (filesToDelete.Any())
        {
            dbContext.ScannedFiles.RemoveRange(filesToDelete);
            await dbContext.SaveChangesAsync(stoppingToken);
        }
    }

    private async Task ProcessNewFolderAsync(string newFolder, FolderMappingOptions mapping, CancellationToken stoppingToken)
    {
        try
        {
            _logger.LogInformation("New folder detected: {FolderPath}", newFolder);
            
            await Task.Delay(_options.ProcessNewFolderDelay, stoppingToken);

            if (!Directory.EnumerateFileSystemEntries(newFolder).Any())
            {
                _logger.LogInformation("Folder is empty, skipping: {FolderPath}", newFolder);
                return;
            }

            var destinationFolder = Path.Combine(mapping.DestinationFolder);
            await ProcessFilesInFolderAsync(newFolder, destinationFolder, mapping);
            
            await _plexHandler.AddFolderForScanningAsync(destinationFolder, mapping.DestinationFolder);
            _knownFolders[mapping.SourceFolder].Add(newFolder);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing folder: {Folder}", newFolder);
        }
    }

    private async Task ProcessFilesInFolderAsync(string sourceFolder, string destinationFolder, FolderMappingOptions mapping)
    {
        foreach (var file in Directory.EnumerateFiles(sourceFolder, "*.*", SearchOption.AllDirectories))
        {
            await ProcessSingleFileAsync(file, destinationFolder, mapping);
        }
    }

    private async Task ProcessSingleFileAsync(string file, string destinationFolder, FolderMappingOptions mapping)
    {
        try 
        {
            using var scope = _serviceScopeFactory.CreateScope();
            var fileTrackingService = scope.ServiceProvider.GetRequiredService<IFileTrackingService>();
            var mediaDetectionService = scope.ServiceProvider.GetRequiredService<IMediaDetectionService>();
            var symlinkHandler = scope.ServiceProvider.GetRequiredService<ISymlinkHandler>();
            
            var trackedFile = await fileTrackingService.AddStatusAsync(file, null, mapping.MediaType, null, null);
            if (trackedFile == null)
            {
                return;
            }

            var mediaInfo = await mediaDetectionService.DetectMediaAsync(file, mapping.MediaType);
            await symlinkHandler.CreateSymlinksAsync(file, destinationFolder, mediaInfo, mapping.MediaType);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing file: {File}", file);
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
            var allFiles = Directory.EnumerateFiles(sourceFolder, "*.*", SearchOption.AllDirectories);
            
            // Process files in batches to avoid memory pressure
            const int batchSize = 100;
            var untrackedFiles = allFiles
                .Where(file => !trackedFiles.Contains(file))
                .Select(file => new { File = file, Folder = Path.GetDirectoryName(file)! })
                .GroupBy(x => x.Folder);

            foreach (var folderGroup in untrackedFiles)
            {
                var destinationFolder = Path.Combine(mapping.DestinationFolder);
                var files = folderGroup.Select(x => x.File);

                foreach (var batch in files.Chunk(batchSize))
                {
                    foreach (var file in batch)
                    {
                        await ProcessSingleFileAsync(file, destinationFolder, mapping);
                    }
                    await Task.Delay(100, stoppingToken); // Small delay between batches
                }

                // Trigger Plex scan after processing each folder
                await _plexHandler.AddFolderForScanningAsync(destinationFolder, mapping.DestinationFolder);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error scanning for untracked files in folder: {Folder}", sourceFolder);
        }
    }

    public override Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("FilePollerService stopping, clearing known folders");
        _knownFolders.Clear();
        return base.StopAsync(cancellationToken);
    }
}