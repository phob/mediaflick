using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Logging;
using System.Collections.Concurrent;
using PlexLocalScan.Shared.Options;
using PlexLocalScan.Data.Models;
using PlexLocalScan.Shared.Interfaces;

namespace PlexLocalScan.Shared.Services;

public class FileWatcherService : BackgroundService
{
    private readonly ILogger<FileWatcherService> _logger;
    private readonly IPlexHandler _plexHandler;
    private readonly ISymlinkHandler _symlinkHandler;
    private readonly PlexOptions _options;
    private readonly ConcurrentDictionary<string, HashSet<string>> _knownFolders = new();
    private readonly IMediaDetectionService _mediaDetectionService;
    private readonly IFileTrackingService _fileTrackingService;
    public FileWatcherService(
        ILogger<FileWatcherService> logger,
        IPlexHandler plexHandler,
        IFileTrackingService fileTrackingService,
        ISymlinkHandler symlinkHandler,
        IMediaDetectionService mediaDetectionService,
        IOptions<PlexOptions> options)
    {
        _logger = logger;
        _plexHandler = plexHandler;
        _fileTrackingService = fileTrackingService;
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
                        try
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
                                try 
                                {
                                    var trackedFile = await _fileTrackingService.TrackFileAsync(file, null, mapping.MediaType, null);
                                    if (trackedFile == null)
                                    {
                                        continue;
                                    }

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
                                catch (Exception ex)
                                {
                                    _logger.LogError(ex, "Error processing file: {File}", file);
                                    continue;
                                }
                            }
                            
                            await _plexHandler.AddFolderForScanningAsync(destinationFolder, mapping.DestinationFolder);
                            _knownFolders[mapping.SourceFolder].Add(newFolder);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Error processing folder: {Folder}", newFolder);
                            continue;
                        }
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