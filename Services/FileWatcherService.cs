using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Logging;
using PlexLocalscan.Options;

namespace PlexLocalscan.Services;

public class FileWatcherService : BackgroundService
{
    private readonly ILogger<FileWatcherService> _logger;
    private readonly IPlexHandler _plexHandler;
    private readonly PlexOptions _options;
    private readonly Dictionary<string, HashSet<string>> _knownFolders = new();

    public FileWatcherService(
        ILogger<FileWatcherService> logger,
        IPlexHandler plexHandler,
        IOptions<PlexOptions> options)
    {
        _logger = logger;
        _plexHandler = plexHandler;
        _options = options.Value;
        
        // Initialize known folders dictionary
        foreach (var folder in _options.FoldersToScan)
        {
            _knownFolders[folder] = new HashSet<string>(Directory.GetDirectories(folder));
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("FileWatcherService started");
        _logger.LogDebug("Monitoring folders: {Folders}", string.Join(", ", _options.FoldersToScan));

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                foreach (var baseFolder in _options.FoldersToScan)
                {
                    _logger.LogDebug("Scanning base folder: {BaseFolder}", baseFolder);
                    var currentFolders = new HashSet<string>(Directory.GetDirectories(baseFolder));
                    _logger.LogDebug("Found {Count} folders in {BaseFolder}", currentFolders.Count, baseFolder);

                    var newFolders = currentFolders.Except(_knownFolders[baseFolder]);
                    var newFolderCount = newFolders.Count();
                    _logger.LogDebug("Detected {Count} new folders in {BaseFolder}", newFolderCount, baseFolder);

                    foreach (var newFolder in newFolders)
                    {
                        _logger.LogInformation("New folder detected: {FolderPath}", newFolder);
                        
                        _logger.LogDebug("Waiting {Delay}ms before processing folder {FolderPath}", 
                            _options.FileWatcherPeriod, newFolder);
                        await Task.Delay(_options.FileWatcherPeriod, stoppingToken);

                        var fileCount = Directory.EnumerateFileSystemEntries(newFolder).Count();
                        _logger.LogDebug("Folder {FolderPath} contains {Count} entries", newFolder, fileCount);

                        if (fileCount == 0)
                        {
                            _logger.LogInformation("Folder is empty, skipping: {FolderPath}", newFolder);
                            continue;
                        }

                        _logger.LogDebug("Requesting Plex scan for folder: {FolderPath}", newFolder);
                        await _plexHandler.AddFolderForScanningAsync(newFolder, baseFolder);
                        
                        _knownFolders[baseFolder].Add(newFolder);
                        _logger.LogDebug("Added {FolderPath} to known folders list", newFolder);
                    }
                }

                _logger.LogDebug("Waiting {Delay} seconds before next scan", 30);
                await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while monitoring folders");
                _logger.LogDebug("Waiting 5 seconds before retry after error");
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
        }

        _logger.LogInformation("FileWatcherService stopping");
    }

    public override Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("FileWatcherService stopping, clearing known folders");
        _knownFolders.Clear();
        return base.StopAsync(cancellationToken);
    }
} 