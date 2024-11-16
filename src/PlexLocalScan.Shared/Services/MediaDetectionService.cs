using Microsoft.Extensions.Logging;
using PlexLocalScan.Data.Models;
using PlexLocalScan.Shared.Interfaces;

namespace PlexLocalScan.Shared.Services;

public class MediaDetectionService : IMediaDetectionService
{
    private readonly ILogger<MediaDetectionService> _logger;
    private readonly IMovieDetectionService _movieDetectionService;
    private readonly ITvShowDetectionService _tvShowDetectionService;
    private readonly IFileTrackingService _fileTrackingService;

    private readonly IFileSystemService _fileSystemService;

    public MediaDetectionService(
        ILogger<MediaDetectionService> logger,
        IMovieDetectionService movieDetectionService,
        ITvShowDetectionService tvShowDetectionService,
        IFileTrackingService fileTrackingService,
        IFileSystemService fileSystemService)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _movieDetectionService = movieDetectionService ?? throw new ArgumentNullException(nameof(movieDetectionService));
        _tvShowDetectionService = tvShowDetectionService ?? throw new ArgumentNullException(nameof(tvShowDetectionService));
        _fileTrackingService = fileTrackingService;

        _fileSystemService = fileSystemService ?? throw new ArgumentNullException(nameof(fileSystemService));
    }

    public async Task<MediaInfo?> DetectMediaAsync(string filePath, MediaType mediaType)
    {
        var fileName = _fileSystemService.GetFileName(filePath);
        _logger.LogDebug("Attempting to detect media info for: {FileName}", fileName);

        try
        {
            return mediaType switch
            {
                MediaType.Movies => await _movieDetectionService.DetectMovieAsync(fileName, filePath),
                MediaType.TvShows => await _tvShowDetectionService.DetectTvShowAsync(fileName, filePath),
                _ => throw new ArgumentException($"Unsupported media type: {mediaType}")
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error detecting media info for {FileName}", fileName);
            await _fileTrackingService.UpdateStatusAsync(filePath, null, MediaType.TvShows, null, FileStatus.Failed);
            throw;
        }
    }
} 
