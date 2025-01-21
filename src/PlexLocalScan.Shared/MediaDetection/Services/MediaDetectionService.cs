using Microsoft.Extensions.Logging;
using PlexLocalScan.Core.Media;
using PlexLocalScan.Core.Tables;
using PlexLocalScan.Shared.DbContext.Interfaces;
using PlexLocalScan.Shared.MediaDetection.Interfaces;

namespace PlexLocalScan.Shared.MediaDetection.Services;

public class MediaDetectionService(
    ILogger<MediaDetectionService> logger,
    IMovieDetectionService movieDetectionService,
    ITvShowDetectionService tvShowDetectionService,
    IContextService contextService)
    : IMediaDetectionService
{
    public async Task<MediaInfo?> DetectMediaAsync(string filePath, MediaType mediaType)
    {
        var mediaInfo = new MediaInfo { MediaType = mediaType };
        var fileName = Path.GetFileName(filePath);
        logger.LogDebug("Attempting to detect media info for: {FileName}", fileName);

        try
        {
            mediaInfo = mediaType switch
            {
                MediaType.Movies => await movieDetectionService.DetectMovieAsync(fileName, filePath),
                MediaType.TvShows => await tvShowDetectionService.DetectTvShowAsync(fileName, filePath),
                MediaType.Extras => mediaInfo,
                MediaType.Unknown => mediaInfo,
                _ => throw new ArgumentException($"Unsupported media type: {mediaType}")
            };

            if (mediaInfo is not null && !IsValidMediaInfo(mediaInfo))
            {
                logger.LogWarning("Invalid or incomplete media info detected for {FileName}", fileName);
                await contextService.UpdateStatusAsync(filePath, null, mediaInfo, FileStatus.Failed);
                return mediaInfo;
            }

            await contextService.UpdateStatusAsync(filePath, null, mediaInfo, FileStatus.Processing);
            return mediaInfo;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error detecting media info for {FileName}", fileName);
            await contextService.UpdateStatusAsync(filePath, null, mediaInfo, FileStatus.Failed);
            return mediaInfo;
        }
    }

    private static bool IsValidMediaInfo(MediaInfo mediaInfo)
    {
        var hasBasicInfo = new[] { mediaInfo }.Any(m =>
            !string.IsNullOrWhiteSpace(m.Title) &&
            m.Year > 0 &&
            m.TmdbId > 0 &&
            m.ImdbId != null);

        if (!hasBasicInfo)
        {
            return false;
        }

        return mediaInfo.MediaType switch
        {
            MediaType.Movies => true,
            MediaType.TvShows => mediaInfo.SeasonNumber > 0 && mediaInfo.EpisodeNumber > 0,
            _ => false
        };
    }
}
