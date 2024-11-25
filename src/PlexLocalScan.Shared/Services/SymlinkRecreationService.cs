using Microsoft.Extensions.Logging;
using PlexLocalScan.Data.Models;
using PlexLocalScan.Shared.Interfaces;

namespace PlexLocalScan.Shared.Services;

public class SymlinkRecreationService(
    ILogger<SymlinkRecreationService> logger,
    IMovieDetectionService movieDetectionService,
    ITvShowDetectionService tvShowDetectionService,
    ISymlinkHandler symlinkHandler,
    ICleanupHandler cleanupHandler,
    IFileTrackingService fileTrackingService) : ISymlinkRecreationService
{
    public async Task<bool> RecreateSymlinkIfNeededAsync(ScannedFile scannedFile)
    {
        try
        {
            if (scannedFile.UpdateToVersion <= scannedFile.VersionUpdated)
            {
                return true; // No update needed
            }

            // Get the new media info based on the updated TMDb ID
            MediaInfo? mediaInfo = null;
            if (scannedFile.TmdbId.HasValue)
            {
                mediaInfo = scannedFile.MediaType switch
                {
                    MediaType.Movies => await movieDetectionService.DetectMovieByTmdbIdAsync(scannedFile.TmdbId.Value),
                    MediaType.TvShows when scannedFile.SeasonNumber.HasValue && scannedFile.EpisodeNumber.HasValue =>
                        await tvShowDetectionService.DetectTvShowByTmdbIdAsync(
                            scannedFile.TmdbId.Value,
                            scannedFile.SeasonNumber.Value,
                            scannedFile.EpisodeNumber.Value),
                    _ => null
                };
            }

            if (mediaInfo == null)
            {
                logger.LogWarning("Failed to get media info for file {SourceFile}", scannedFile.SourceFile);
                return false;
            }

            // Delete the old symlink if it exists
            if (!string.IsNullOrEmpty(scannedFile.DestFile) && File.Exists(scannedFile.DestFile))
            {
                var oldDestFolder = Path.GetDirectoryName(scannedFile.DestFile);
                File.Delete(scannedFile.DestFile);

                // Clean up empty directories
                if (oldDestFolder != null)
                {
                    await cleanupHandler.CleanupDeadSymlinksAsync(oldDestFolder);
                }
            }

            // Create the new symlink
            var destFolder = Path.GetDirectoryName(scannedFile.DestFile);
            if (destFolder == null)
            {
                logger.LogError("Destination folder is null for file {SourceFile}", scannedFile.SourceFile);
                return false;
            }

            await symlinkHandler.CreateSymlinksAsync(scannedFile.SourceFile, destFolder, mediaInfo, mediaInfo.MediaType);

            // Update the version number to match
            scannedFile.VersionUpdated = scannedFile.UpdateToVersion;
            await fileTrackingService.UpdateStatusAsync(
                scannedFile.SourceFile,
                scannedFile.DestFile,
                scannedFile.MediaType,
                scannedFile.TmdbId,
                scannedFile.SeasonNumber,
                scannedFile.EpisodeNumber,
                FileStatus.Success);

            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error recreating symlink for file {SourceFile}", scannedFile.SourceFile);
            return false;
        }
    }
} 