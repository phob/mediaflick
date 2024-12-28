using Microsoft.Extensions.Logging;
using PlexLocalScan.Core.Media;
using PlexLocalScan.Core.Tables;
using PlexLocalScan.FileTracking.Services;
using PlexLocalScan.Shared.Interfaces;

namespace PlexLocalScan.Shared.Services;

public class MediaDetectionService(
    ILogger<MediaDetectionService> logger,
    IMovieDetectionService movieDetectionService,
    ITvShowDetectionService tvShowDetectionService,
    IContextService contextService,
    IFileSystemService fileSystemService)
    : IMediaDetectionService
{
    public async Task<MediaInfo?> DetectMediaAsync(string filePath, MediaType mediaType)
    {
        var fileName = fileSystemService.GetFileName(filePath);
        logger.LogDebug("Attempting to detect media info for: {FileName}", fileName);

        try
        {
            return mediaType switch
            {
                MediaType.Movies => await movieDetectionService.DetectMovieAsync(fileName, filePath),
                MediaType.TvShows => await tvShowDetectionService.DetectTvShowAsync(fileName, filePath),
                MediaType.Extras => null,
                MediaType.Unknown => null,
                _ => throw new ArgumentException($"Unsupported media type: {mediaType}")
            };
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error detecting media info for {FileName}", fileName);
            await contextService.UpdateStatusAsync(filePath, null, MediaType.TvShows, null, null, null, null, null, null, null, FileStatus.Failed);
            throw;
        }
    }
} 
