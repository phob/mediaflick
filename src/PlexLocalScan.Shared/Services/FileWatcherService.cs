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

public class FileWatcherService : BackgroundService
{
    private readonly ILogger<FileWatcherService> _logger;
    private readonly IPlexHandler _plexHandler;
    private readonly PlexOptions _options;
    private readonly ConcurrentDictionary<string, HashSet<string>> _knownFolders = new();
    private readonly IServiceScopeFactory _serviceScopeFactory;

    public FileWatcherService(
        ILogger<FileWatcherService> logger,
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
        _logger.LogInformation("FileWatcherService started");

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

        _logger.LogInformation("FileWatcherService shutting down");
    }

    private async Task ProcessAllMappingsAsync(CancellationToken stoppingToken)
    {
        using var scope = _serviceScopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<PlexScanContext>();
        var cleanupHandler = scope.ServiceProvider.GetRequiredService<ICleanupHandler>();
        
        foreach (var mapping in _options.FolderMappings)
        {
            var fullSourcePath = Path.GetFullPath(mapping.SourceFolder);
            _logger.LogDebug("Scanning source folder: {SourceFolder}", fullSourcePath);

            // Check if the source folder still exists
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

            // Get all tracked files for this source folder
            var trackedFiles = await dbContext.ScannedFiles
                .Where(f => f.SourceFile.StartsWith(fullSourcePath))
                .ToListAsync(stoppingToken);

            // Check for deleted files
            foreach (var trackedFile in trackedFiles)
            {
                if (!File.Exists(trackedFile.SourceFile))
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

                    // Remove the database entry
                    dbContext.ScannedFiles.Remove(trackedFile);
                }
            }

            // Save any changes from deleted file cleanup
            if (dbContext.ChangeTracker.HasChanges())
            {
                await dbContext.SaveChangesAsync(stoppingToken);
            }

            // Process new folders
            var processedFolders = new HashSet<string>(
                trackedFiles.Select(f => Path.GetDirectoryName(f.SourceFile)!)
            );

            var foldersToProcess = currentFolders
                .Where(folder => !processedFolders.Contains(folder));

            foreach (var folder in foldersToProcess)
            {
                await ProcessNewFolderAsync(folder, mapping, stoppingToken);
            }

            // Clean up empty directories in destination folder
            if (Directory.Exists(mapping.DestinationFolder))
            {
                await cleanupHandler.CleanupDeadSymlinksAsync(mapping.DestinationFolder);
            }

            // Update known folders for future reference
            _knownFolders[mapping.SourceFolder] = [..currentFolders];
        }
    }

    private async Task ProcessNewFolderAsync(string newFolder, FolderMapping mapping, CancellationToken stoppingToken)
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

    private async Task ProcessFilesInFolderAsync(string sourceFolder, string destinationFolder, FolderMapping mapping)
    {
        foreach (var file in Directory.EnumerateFiles(sourceFolder, "*.*", SearchOption.AllDirectories))
        {
            await ProcessSingleFileAsync(file, destinationFolder, mapping);
        }
    }

    private async Task ProcessSingleFileAsync(string file, string destinationFolder, FolderMapping mapping)
    {
        try 
        {
            using var scope = _serviceScopeFactory.CreateScope();
            var fileTrackingService = scope.ServiceProvider.GetRequiredService<IFileTrackingService>();
            var mediaDetectionService = scope.ServiceProvider.GetRequiredService<IMediaDetectionService>();
            var symlinkHandler = scope.ServiceProvider.GetRequiredService<ISymlinkHandler>();
            
            var trackedFile = await fileTrackingService.AddStatusAsync(file, null, mapping.MediaType, null);
            if (trackedFile == null)
            {
                return;
            }

            var mediaInfo = await mediaDetectionService.DetectMediaAsync(file, mapping.MediaType);
            if (mediaInfo != null)
            {
                await symlinkHandler.CreateSymlinksAsync(file, destinationFolder, mediaInfo);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing file: {File}", file);
        }
    }
    public override Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("FileWatcherService stopping, clearing known folders");
        _knownFolders.Clear();
        return base.StopAsync(cancellationToken);
    }
} 