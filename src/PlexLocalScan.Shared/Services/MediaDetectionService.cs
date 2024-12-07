using Microsoft.Extensions.Logging;
using PlexLocalScan.Data.Models;
using PlexLocalScan.Shared.Interfaces;
using PlexLocalScan.Shared.Models.Media;

namespace PlexLocalScan.Shared.Services;

public class MediaDetectionService(
    ILogger<MediaDetectionService> logger,
    IMovieDetectionService movieDetectionService,
    ITvShowDetectionService tvShowDetectionService,
    IFileTrackingService fileTrackingService,
    IFileSystemService fileSystemService)
    : IMediaDetectionService
{
    private readonly ILogger<MediaDetectionService> _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    private readonly IMovieDetectionService _movieDetectionService = movieDetectionService ?? throw new ArgumentNullException(nameof(movieDetectionService));
    private readonly ITvShowDetectionService _tvShowDetectionService = tvShowDetectionService ?? throw new ArgumentNullException(nameof(tvShowDetectionService));

    private readonly IFileSystemService _fileSystemService = fileSystemService ?? throw new ArgumentNullException(nameof(fileSystemService));

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
            await fileTrackingService.UpdateStatusAsync(filePath, null, MediaType.TvShows, null, null, FileStatus.Failed);
            throw;
        }
    }
} 
