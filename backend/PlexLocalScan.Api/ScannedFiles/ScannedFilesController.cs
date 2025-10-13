using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PlexLocalScan.Abstractions;
using PlexLocalScan.Api.Models;
using PlexLocalScan.Api.ScannedFiles.Models;
using PlexLocalScan.Core.Tables;
using PlexLocalScan.Data.Data;
using PlexLocalScan.Shared.Configuration.Options;
using PlexLocalScan.Shared.Symlinks.Interfaces;
using PlexLocalScan.Shared.Plex.Interfaces;
using PlexLocalScan.Shared.Plex.Services;

namespace PlexLocalScan.Api.ScannedFiles;

/// <summary>
/// Endpoint implementations for scanned files functionality
/// </summary>
internal static class ScannedFilesController
{
    internal static async Task<IResult> GetScannedFiles(
        [FromQuery] ScannedFileFilter filter,
        [FromBody] int[]? ids,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10,
        PlexScanContext context = null!,
        ILogger<Program> logger = null!
    )
    {
        logger.LogDebug(
            "Getting scanned files. IDs: {Ids}, Page: {Page}, PageSize: {PageSize}, Status: {Status}, MediaType: {MediaType}, SearchTerm: {SearchTerm}, SortBy: {SortBy}, SortOrder: {SortOrder}",
            ids != null ? string.Join(",", ids) : "all",
            page,
            pageSize,
            filter.Status,
            filter.MediaType,
            filter.SearchTerm,
            filter.SortBy,
            filter.SortOrder
        );

        var query = context.ScannedFiles.AsQueryable();

        // Apply ID filter if provided
        if (ids != null && ids.Length > 0)
        {
            query = query.Where(f => ids.Contains(f.Id));
        }

        // Apply filters
        if (filter.Status.HasValue)
        {
            query = query.Where(f => f.Status == filter.Status.Value);
        }

        if (filter.MediaType.HasValue)
        {
            query = query.Where(f => f.MediaType == filter.MediaType.Value);
        }

        if (!string.IsNullOrEmpty(filter.SearchTerm))
        {
            var searchTerm = filter.SearchTerm.ToUpperInvariant();
            query = query.Where(f =>
                EF.Functions.Like(f.SourceFile.ToUpper(), $"%{searchTerm}%")
                || f.DestFile != null && EF.Functions.Like(f.DestFile.ToUpper(), $"%{searchTerm}%")
            );
        }

        // Apply sorting
        query = filter.SortBy?.ToLowerInvariant() switch
        {
            "createdat" => filter.SortOrder?.ToLowerInvariant() == "desc"
                ? query.OrderByDescending(f => f.CreatedAt)
                : query.OrderBy(f => f.CreatedAt),
            "updatedat" => filter.SortOrder?.ToLowerInvariant() == "desc"
                ? query.OrderByDescending(f => f.UpdatedAt)
                : query.OrderBy(f => f.UpdatedAt),
            "sourcefile" => filter.SortOrder?.ToLowerInvariant() == "desc"
                ? query.OrderByDescending(f => f.SourceFile)
                : query.OrderBy(f => f.SourceFile),
            "destfile" => filter.SortOrder?.ToLowerInvariant() == "desc"
                ? query.OrderByDescending(f => f.DestFile)
                : query.OrderBy(f => f.DestFile),
            "filesize" => filter.SortOrder?.ToLowerInvariant() == "desc"
                ? query.OrderByDescending(f => f.FileSize)
                : query.OrderBy(f => f.FileSize),
            "filehash" => filter.SortOrder?.ToLowerInvariant() == "desc"
                ? query.OrderByDescending(f => f.FileHash)
                : query.OrderBy(f => f.FileHash),
            "status" => filter.SortOrder?.ToLowerInvariant() == "desc"
                ? query.OrderByDescending(f => f.Status)
                : query.OrderBy(f => f.Status),
            "mediatype" => filter.SortOrder?.ToLowerInvariant() == "desc"
                ? query.OrderByDescending(f => f.MediaType)
                : query.OrderBy(f => f.MediaType),
            "seasonnumber" => filter.SortOrder?.ToLowerInvariant() == "desc"
                ? query.OrderByDescending(f => f.SeasonNumber)
                : query.OrderBy(f => f.SeasonNumber),
            "episodenumber" => filter.SortOrder?.ToLowerInvariant() == "desc"
                ? query.OrderByDescending(f => f.EpisodeNumber)
                : query.OrderBy(f => f.EpisodeNumber),
            "episode" => filter.SortOrder?.ToLowerInvariant() == "desc"
                ? query.OrderByDescending(f => f.SeasonNumber * 100 + f.EpisodeNumber)
                : query.OrderBy(f => f.SeasonNumber * 100 + f.EpisodeNumber),
            "title" => filter.SortOrder?.ToLowerInvariant() == "desc"
                ? query.OrderByDescending(f => f.Title)
                : query.OrderBy(f => f.Title),
            _ => query.OrderBy(f => f.SourceFile), // Default sorting
        };

        var totalItems = await query.CountAsync();
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

        logger.LogDebug(
            "Retrieved {Count} scanned files. Total items: {TotalItems}, Total pages: {TotalPages}",
            items.Count,
            totalItems,
            (int)Math.Ceiling(totalItems / (double)pageSize)
        );

        return Results.Ok(
            new PagedResult<ScannedFileDto>
            {
                Items = items.Select(ScannedFileDto.FromScannedFile).ToList(),
                TotalItems = totalItems,
                Page = page,
                PageSize = pageSize,
                TotalPages = (int)Math.Ceiling(totalItems / (double)pageSize),
            }
        );
    }

    internal static async Task<IResult> GetTmdbIdsAndTitles(
        [FromQuery] ScannedFileFilter filter,
        PlexScanContext context = null!,
        ILogger<Program> logger = null!
    )
    {
        logger.LogDebug("Getting TMDb IDs and titles with filter: {@Filter}", filter);

        var query = context.ScannedFiles.AsQueryable();

        query = query.Where(f => f.Status == FileStatus.Success);

        if (filter.MediaType.HasValue)
        {
            query = query.Where(f => f.MediaType == filter.MediaType.Value);
        }

        if (!string.IsNullOrEmpty(filter.SearchTerm))
        {
            var searchTerm = filter.SearchTerm.ToUpperInvariant();
            query = query.Where(f =>
                f.Title != null && EF.Functions.Like(f.Title.ToUpper(), $"%{searchTerm}%")
            );
        }

        var tmdbIdsAndTitles = await query
            .Select(f => new { f.TmdbId, f.Title })
            .Distinct()
            .OrderBy(f => f.Title)
            .ToListAsync();
        logger.LogDebug(
            "Retrieved {Count} unique TMDb IDs and titles",
            tmdbIdsAndTitles.Count
        );
        return Results.Ok(tmdbIdsAndTitles);
    }

    internal static async Task<IResult> GetScannedFile(
        int id,
        PlexScanContext context = null!,
        ILogger<Program> logger = null!
    )
    {
        logger.LogInformation("Getting scanned file with ID: {Id}", id);
        var scannedFile = await context.ScannedFiles.FindAsync(id);

        if (scannedFile == null)
        {
            logger.LogWarning("Scanned file with ID {Id} not found", id);
            return Results.NotFound();
        }

        logger.LogInformation("Retrieved scanned file: {@ScannedFile}", scannedFile);
        return Results.Ok(ScannedFileDto.FromScannedFile(scannedFile));
    }

    internal static async Task<IResult> GetStats(
        PlexScanContext context = null!,
        ILogger<Program> logger = null!
    )
    {
        logger.LogDebug("Getting scanned files statistics");

        var stats = new ScannedFileStats
        {
            TotalFiles = await context.ScannedFiles.CountAsync(),
            TotalSuccessfulFiles = await context.ScannedFiles.CountAsync(f => f.Status == FileStatus.Success),
            TotalFileSize = await context.ScannedFiles.SumAsync(f => f.FileSize ?? 0),
            TotalSuccessfulFileSize = await context.ScannedFiles.Where(f => f.Status == FileStatus.Success).SumAsync(f => f.FileSize ?? 0),
            ByStatus = await context
                .ScannedFiles.GroupBy(f => f.Status)
                .Select(g => new StatusCount { Status = g.Key, Count = g.Count() })
                .ToListAsync(),
            ByMediaType = await context
                .ScannedFiles.Where(f => f.MediaType.HasValue)
                .GroupBy(f => f.MediaType!.Value)
                .Select(g => new MediaTypeCount { MediaType = g.Key, Count = g.Count() })
                .ToListAsync(),
        };

        logger.LogDebug("Retrieved statistics: {@Stats}", stats);
        return Results.Ok(stats);
    }

    internal static async Task<IResult> UpdateScannedFile(
        int id,
        [FromBody] UpdateScannedFileRequest request,
        PlexScanContext context = null!,
        INotificationService notificationService = null!,
        ILogger<Program> logger = null!
    )
    {
        try
        {
            logger.LogInformation(
                "Updating scanned file {Id} with request: {@Request}",
                id,
                request
            );

            var scannedFile = await context.ScannedFiles.FindAsync(id);

            if (scannedFile == null)
            {
                logger.LogWarning("Scanned file with ID {Id} not found", id);
                return Results.NotFound();
            }

            var oldMediaType = scannedFile.MediaType;

            // Handle MediaType changes
            if (request.MediaType.HasValue && request.MediaType.Value != oldMediaType)
            {
                logger.LogInformation(
                    "Changing MediaType for file {Id} from {OldType} to {NewType}",
                    id,
                    oldMediaType,
                    request.MediaType.Value
                );

                // Converting TO Extras
                if (request.MediaType.Value == MediaType.Extras)
                {
                    // Delete symlink if it exists
                    if (!string.IsNullOrEmpty(scannedFile.DestFile) && File.Exists(scannedFile.DestFile))
                    {
                        try
                        {
                            File.Delete(scannedFile.DestFile);
                            logger.LogInformation("Deleted symlink: {DestFile}", scannedFile.DestFile);
                        }
                        catch (Exception ex)
                        {
                            logger.LogError(ex, "Failed to delete symlink: {DestFile}", scannedFile.DestFile);
                        }
                    }

                    // Clear TMDb-related fields
                    scannedFile.MediaType = MediaType.Extras;
                    scannedFile.TmdbId = null;
                    scannedFile.ImdbId = null;
                    scannedFile.Title = null;
                    scannedFile.Year = null;
                    scannedFile.Genres = null;
                    scannedFile.SeasonNumber = null;
                    scannedFile.EpisodeNumber = null;
                    scannedFile.EpisodeNumber2 = null;
                    scannedFile.DestFile = null;
                    scannedFile.Status = FileStatus.Success;
                }
                // Converting FROM Extras to Movie/TvShow
                else if (oldMediaType == MediaType.Extras)
                {
                    scannedFile.MediaType = request.MediaType.Value;
                    scannedFile.Status = FileStatus.Processing;
                    // Keep new MediaType, trigger re-processing
                    // The file processing pipeline will handle TMDb lookup and symlink creation
                    logger.LogInformation(
                        "File {Id} converted from Extras to {NewType}, status set to Processing for re-detection",
                        id,
                        request.MediaType.Value
                    );
                }
                else
                {
                    // Direct conversion between Movies/TvShows (not part of Extras feature, but handle it)
                    scannedFile.MediaType = request.MediaType.Value;
                }
            }

            // Update only the provided values (non-MediaType fields)
            if (request.TmdbId.HasValue)
            {
                scannedFile.TmdbId = request.TmdbId.Value;
            }

            if (request.SeasonNumber.HasValue)
            {
                scannedFile.SeasonNumber = request.SeasonNumber.Value;
            }

            if (request.EpisodeNumber.HasValue)
            {
                scannedFile.EpisodeNumber = request.EpisodeNumber.Value;
            }
            if (request.EpisodeNumber2.HasValue)
            {
                scannedFile.EpisodeNumber2 = request.EpisodeNumber2.Value;
            }

            scannedFile.UpdatedAt = DateTime.UtcNow;
            scannedFile.UpdateToVersion++;

            await context.SaveChangesAsync();

            // Trigger SignalR notification
            await notificationService.NotifyFileUpdated(scannedFile);

            logger.LogInformation("Successfully updated scanned file {Id}", id);
            return Results.Ok(scannedFile);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to update scanned file {Id}", id);
            return Results.BadRequest(
                new { error = "Failed to update the scanned file", details = ex.Message }
            );
        }
    }

    internal static async Task<IResult> RecreateSymlink(
        int id,
        PlexScanContext context = null!,
        ISymlinkRecreationService symlinkRecreationService = null!,
        ILogger<Program> logger = null!
    )
    {
        try
        {
            var scannedFile = await context.ScannedFiles.FindAsync(id);
            if (scannedFile == null)
            {
                logger.LogWarning("Scanned file with ID {Id} not found", id);
                return Results.NotFound();
            }

            await context.SaveChangesAsync();

            // Attempt to recreate the symlink with the new information
            var success = await symlinkRecreationService.RecreateSymlinkIfNeededAsync(scannedFile);
            if (!success)
            {
                logger.LogError("Failed to recreate symlink for scanned file {Id}", id);
                return Results.BadRequest(new { error = "Failed to recreate symlink" });
            }

            // Refresh the entity from the database to get the latest version
            await context.Entry(scannedFile).ReloadAsync();
            logger.LogInformation(
                "Successfully updated scanned file {Id}: {@ScannedFile}",
                id,
                scannedFile
            );
            return Results.Ok(scannedFile);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to update scanned file {Id}", id);
            return Results.BadRequest(
                new { error = "Failed to update the scanned file", details = ex.Message }
            );
        }
    }

    internal static async Task<IResult> DeleteScannedFiles(
        [FromBody] int[]? ids,
        PlexScanContext context = null!,
        ICleanupHandler cleanupHandler = null!,
        IOptionsSnapshot<PlexOptions> plexOptions = null!,
        INotificationService notificationService = null!,
        ILogger<Program> logger = null!
    )
    {
        if (ids == null || ids.Length == 0)
        {
            return Results.BadRequest(new { error = "No IDs provided for deletion" });
        }

        logger.LogInformation("Deleting multiple scanned files. IDs: {@Ids}", ids);

        var filesToDelete = await context.ScannedFiles.Where(f => ids.Contains(f.Id)).ToListAsync();

        if (filesToDelete.Count > 0)
        {
            // Group files by media type for efficient cleanup
            var filesByMediaType = filesToDelete.GroupBy(f => f.MediaType);

            foreach (var mediaTypeGroup in filesByMediaType)
            {
                if (!mediaTypeGroup.Key.HasValue)
                {
                    continue;
                }

                var folderMapping = plexOptions.Value.FolderMappings.FirstOrDefault(fm =>
                    fm.MediaType == mediaTypeGroup.Key
                );

                if (folderMapping != null)
                {
                    // Delete all destination files for this media type
                    foreach (var file in mediaTypeGroup)
                    {
                        if (
                            !string.IsNullOrEmpty(file.DestFile)
                            && file.Status == FileStatus.Success
                        )
                        {
                            File.Delete(file.DestFile);
                        }

                        // Notify clients about each deletion
                        await notificationService.NotifyFileRemoved(file);
                    }

                    // Clean up empty directories once per media type
                    await cleanupHandler.CleanupDeadSymlinksAsync(folderMapping.DestinationFolder);
                }
            }

            context.ScannedFiles.RemoveRange(filesToDelete);
            await context.SaveChangesAsync();
        }

        logger.LogInformation("Successfully deleted {Count} scanned files", filesToDelete.Count);
        return Results.Ok(new { deletedIds = ids });
    }

    internal static async Task<IResult> RecreateSymlinks(
        ISymlinkRecreationService symlinkRecreationService,
        IOptionsSnapshot<PlexOptions> plexOptions,
        IPlexHandler plexHandler,
        ILogger<Program> logger
    )
    {
        logger.LogInformation("Starting recreation of all symlinks");

        Dictionary<string, HashSet<string>> beforeFiles = PlexPrepare.SnapshotBefore(plexOptions.Value.FolderMappings);

        // Recreate symlinks
        var successCount = await symlinkRecreationService.RecreateAllSymlinksAsync();

        Dictionary<string, FolderAction> directoryChanges = PlexPrepare.SnapshotAfter(plexOptions.Value.FolderMappings, beforeFiles);

        // Notify Plex about directory changes
        foreach (var change in directoryChanges)
        {
            await plexHandler.UpdateFolderForScanningAsync(change.Key, change.Value);
        }

        logger.LogInformation(
            "Completed recreation of symlinks. Success count: {SuccessCount}, Directory changes: {DirectoryChanges}",
            successCount,
            directoryChanges.Count
        );

        return Results.Ok(new
        {
            SuccessCount = successCount,
            DirectoryChanges = directoryChanges.Select(dc => new
            {
                Directory = dc.Key,
                Action = dc.Value.ToString()
            }).ToList()
        });
    }

}
