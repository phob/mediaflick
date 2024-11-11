using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Logging;
using PlexLocalScan.Options;
using System.Collections.Concurrent;

namespace PlexLocalScan.Services;

public class FileWatcherService : BackgroundService
{
    private readonly ILogger<FileWatcherService> _logger;
    private readonly IPlexHandler _plexHandler;
    private readonly ISymlinkHandler _symlinkHandler;
    private readonly PlexOptions _options;
    private readonly ConcurrentDictionary<string, HashSet<string>> _knownFolders = new();
    private readonly IMediaDetectionService _mediaDetectionService;

    public FileWatcherService(
        ILogger<FileWatcherService> logger,
        IPlexHandler plexHandler,
        ISymlinkHandler symlinkHandler,
        IMediaDetectionService mediaDetectionService,
        IOptions<PlexOptions> options)
    {
        _logger = logger;
        _plexHandler = plexHandler;
        _symlinkHandler = symlinkHandler;
        _options = options.Value;
        _mediaDetectionService = mediaDetectionService;
        
        // Initialize known folders dictionary
        foreach (var mapping in _options.FolderMappings)
        {
            _knownFolders[mapping.SourceFolder] = new HashSet<string>(
                Directory.GetDirectories(mapping.SourceFolder));
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("FileWatcherService started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                foreach (var mapping in _options.FolderMappings)
                {
                    var fullSourcePath = Path.GetFullPath(mapping.SourceFolder);
                    _logger.LogDebug("Scanning source folder: {SourceFolder}", fullSourcePath);

                    var currentFolders = new HashSet<string>(Directory.GetDirectories(fullSourcePath));
                    var newFolders = currentFolders.Except(_knownFolders[mapping.SourceFolder]);

                    foreach (var newFolder in newFolders)
                    {
                        _logger.LogInformation("New folder detected: {FolderPath}", newFolder);
                        
                        await Task.Delay(_options.FileWatcherPeriod, stoppingToken);

                        if (!Directory.EnumerateFileSystemEntries(newFolder).Any())
                        {
                            _logger.LogInformation("Folder is empty, skipping: {FolderPath}", newFolder);
                            continue;
                        }

                        var destinationFolder = Path.Combine(mapping.DestinationFolder);

                        foreach (var file in Directory.EnumerateFiles(newFolder, "*.*", SearchOption.AllDirectories))
                        {
                            var mediaInfo = await _mediaDetectionService.DetectMediaAsync(file, mapping.MediaType);
                            if (mediaInfo != null)
                            {
                                _logger.LogInformation("Detected {MediaType}: {Title} ({Year})", 
                                    mediaInfo.MediaType, 
                                    mediaInfo.Title,
                                    mediaInfo.Year?.ToString() ?? "Unknown Year");
                                
                                if (mediaInfo.MediaType == MediaType.TvShows)
                                {
                                    _logger.LogInformation("Season {Season}, Episode {Episode}, Title: {EpisodeTitle}",
                                        mediaInfo.SeasonNumber,
                                        mediaInfo.EpisodeNumber,
                                        mediaInfo.EpisodeTitle);
                                }
                                await _symlinkHandler.CreateSymlinksAsync(file, destinationFolder, mediaInfo);
                            }
                        }
                        await _plexHandler.AddFolderForScanningAsync(destinationFolder, mapping.DestinationFolder);
                        
                        _knownFolders[mapping.SourceFolder].Add(newFolder);
                    }
                }

                await Task.Delay(TimeSpan.FromSeconds(_options.PollingInterval), stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error occurred while monitoring folders");
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
        }
    }

    public override Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("FileWatcherService stopping, clearing known folders");
        _knownFolders.Clear();
        return base.StopAsync(cancellationToken);
    }
} 