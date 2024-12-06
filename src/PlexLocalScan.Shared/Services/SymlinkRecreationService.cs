using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PlexLocalScan.Data.Models;
using PlexLocalScan.Shared.Interfaces;
using Microsoft.EntityFrameworkCore;
using PlexLocalScan.Data.Data;
using PlexLocalScan.Shared.Options;

namespace PlexLocalScan.Shared.Services;

public class SymlinkRecreationService(
    ILogger<SymlinkRecreationService> logger,
    IMovieDetectionService movieDetectionService,
    ITvShowDetectionService tvShowDetectionService,
    ISymlinkHandler symlinkHandler,
    ICleanupHandler cleanupHandler,
    IFileTrackingService fileTrackingService,
    IOptions<PlexOptions> plexOptions,
    PlexScanContext dbContext) : ISymlinkRecreationService
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
                File.Delete(scannedFile.DestFile);
            }

            // Get the correct destination folder from configuration
            var folderMapping = plexOptions.Value.FolderMappings
                .FirstOrDefault(m => m.MediaType == mediaInfo.MediaType);

            if (folderMapping == null)
            {
                logger.LogError("No folder mapping found for media type {MediaType}", mediaInfo.MediaType);
                return false;
            }

            var destFolder = folderMapping.DestinationFolder;
            if (string.IsNullOrEmpty(destFolder))
            {
                logger.LogError("Destination folder is null or empty for media type {MediaType}", mediaInfo.MediaType);
                return false;
            }

            // Clean up empty directories in the correct destination folder
            await cleanupHandler.CleanupDeadSymlinksAsync(destFolder);

            // Create the new symlink
            await symlinkHandler.CreateSymlinksAsync(scannedFile.SourceFile, destFolder, mediaInfo, mediaInfo.MediaType);

            // Update the version number to match
            scannedFile.VersionUpdated = scannedFile.UpdateToVersion;
            await fileTrackingService.UpdateStatusAsync(
                scannedFile.SourceFile,
                scannedFile.DestFile,
                scannedFile.MediaType,
                scannedFile.TmdbId,
                scannedFile.ImdbId,
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

    public async Task<int> RecreateAllSymlinksAsync()
    {
        var successCount = 0;
        var failedCount = 0;

        try
        {
            // Get all files that need updating
            var filesToUpdate = await dbContext.ScannedFiles
                .Where(f => f.UpdateToVersion > f.VersionUpdated)
                .ToListAsync();

            logger.LogInformation("Found {Count} files that need symlink recreation", filesToUpdate.Count);

            // Group files by TMDb ID to check for duplicates
            var movieGroups = filesToUpdate
                .Where(f => f.MediaType == MediaType.Movies && f.TmdbId.HasValue)
                .GroupBy(f => f.TmdbId!.Value);

            var tvShowGroups = filesToUpdate
                .Where(f => f.MediaType == MediaType.TvShows && f.TmdbId.HasValue && f.SeasonNumber.HasValue && f.EpisodeNumber.HasValue)
                .GroupBy(f => new { TmdbId = f.TmdbId!.Value, Season = f.SeasonNumber!.Value, Episode = f.EpisodeNumber!.Value });

            // Process movies - only keep the first file for each TMDb ID
            foreach (var movieGroup in movieGroups)
            {
                var firstFile = movieGroup.First();
                var duplicates = movieGroup.Skip(1);

                // Process the first file
                if (await RecreateSymlinkIfNeededAsync(firstFile))
                {
                    successCount++;
                }
                else
                {
                    failedCount++;
                }

                // Mark duplicates as failed
                foreach (var duplicate in duplicates)
                {
                    await fileTrackingService.UpdateStatusAsync(
                        duplicate.SourceFile,
                        duplicate.DestFile,
                        duplicate.MediaType,
                        duplicate.TmdbId,
                        duplicate.ImdbId,
                        FileStatus.Failed);
                    failedCount++;
                }
            }

            // Process TV shows - only keep the first file for each TMDb ID + season + episode combination
            foreach (var tvShowGroup in tvShowGroups)
            {
                var firstFile = tvShowGroup.First();
                var duplicates = tvShowGroup.Skip(1);

                // Process the first file
                if (await RecreateSymlinkIfNeededAsync(firstFile))
                {
                    successCount++;
                }
                else
                {
                    failedCount++;
                }

                // Mark duplicates as failed
                foreach (var duplicate in duplicates)
                {
                    await fileTrackingService.UpdateStatusAsync(
                        duplicate.SourceFile,
                        duplicate.DestFile,
                        duplicate.MediaType,
                        duplicate.TmdbId,
                        duplicate.ImdbId,
                        FileStatus.Failed);
                    failedCount++;
                }
            }
            logger.LogInformation("Symlink recreation completed. Success: {SuccessCount}, Failed: {FailedCount}", 
                successCount, failedCount);

            return successCount;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error during bulk symlink recreation");
            return successCount;
        }
    }
} 