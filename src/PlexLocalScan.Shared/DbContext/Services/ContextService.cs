using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PlexLocalScan.Abstractions;
using PlexLocalScan.Core.Media;
using PlexLocalScan.Core.Tables;
using PlexLocalScan.Data.Data;
using PlexLocalScan.Shared.DbContext.Interfaces;

namespace PlexLocalScan.Shared.DbContext.Services;

public class ContextService(
    PlexScanContext dbContext,
    ILogger<ContextService> logger,
    INotificationService notificationService
) : IContextService
{
    // Compiled queries for better performance
    private static readonly Func<PlexScanContext, string, Task<ScannedFile?>> GetBySourceFileQuery =
        EF.CompileAsyncQuery(
            (PlexScanContext context, string sourceFile) =>
                context.ScannedFiles.FirstOrDefault(f => f.SourceFile == sourceFile)
        );

    private static readonly Func<PlexScanContext, int, Task<List<ScannedFile>>> GetByTmdbIdQuery =
        EF.CompileAsyncQuery(
            (PlexScanContext context, int tmdbId) =>
                context.ScannedFiles.Where(f => f.TmdbId == tmdbId).ToList()
        );

    private async Task<ScannedFile?> GetExistingScannedFileAsync(
        string sourceFile,
        string? type = null
    )
    {
        var scannedFile = await GetBySourceFileQuery(dbContext, sourceFile);

        if (scannedFile == null)
        {
            return null;
        }

        if (scannedFile.Status == FileStatus.Success && type == "add")
        {
            logger.LogInformation("File already tracked and successful: {SourceFile}", sourceFile);
            return scannedFile;
        }
        logger.LogDebug("File already tracked: {SourceFile}", sourceFile);

        return scannedFile;
    }

    public async Task<ScannedFile?> AddStatusAsync(
        string sourceFile,
        string? destFile,
        MediaType mediaType,
        long? fileSize,
        string? fileHash
    )
    {
        var scannedFile = await GetExistingScannedFileAsync(sourceFile, "add");
        if (scannedFile != null)
        {
            return scannedFile;
        }

        scannedFile = new ScannedFile
        {
            SourceFile = sourceFile,
            DestFile = destFile,
            MediaType = mediaType,
            Status = FileStatus.Processing,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow,
            FileSize = fileSize,
            FileHash = fileHash,
        };

        await dbContext.ScannedFiles.AddAsync(scannedFile);

        try
        {
            await dbContext.SaveChangesAsync();
            logger.LogInformation(
                "Tracked new file: {SourceFile} -> {DestFile}",
                sourceFile,
                destFile
            );

            // Notify clients about the new file
            await notificationService.NotifyFileAdded(scannedFile);

            return scannedFile;
        }
        catch (DbUpdateException ex)
        {
            logger.LogError(ex, "Error adding file to tracking: {SourceFile}", sourceFile);

            // Check if it's a unique constraint violation
            if (
                ex.InnerException?.Message.Contains(
                    "UNIQUE constraint failed",
                    StringComparison.OrdinalIgnoreCase
                ) != true
            )
            {
                return await GetExistingScannedFileAsync(sourceFile, "add");
            }
            // Try to determine which constraint failed

            if (
                ex.InnerException.Message.Contains("SourceFile", StringComparison.OrdinalIgnoreCase)
            )
            {
                // Source file conflict - just return the existing file
                return await GetExistingScannedFileAsync(sourceFile, "add");
            }

            if (!ex.InnerException.Message.Contains("DestFile", StringComparison.OrdinalIgnoreCase))
            {
                return await GetExistingScannedFileAsync(sourceFile, "add");
            }
            // Dest file conflict - clear the dest file and mark as duplicate
            scannedFile.DestFile = null;
            scannedFile.Status = FileStatus.Duplicate;

            try
            {
                await dbContext.SaveChangesAsync();
                logger.LogInformation(
                    "Cleared DestFile and marked as duplicate for: {SourceFile}",
                    sourceFile
                );
                await notificationService.NotifyFileAdded(scannedFile);
                return scannedFile;
            }
            catch (Exception retryEx)
            {
                logger.LogError(
                    retryEx,
                    "Error saving file after clearing DestFile: {SourceFile}",
                    sourceFile
                );
                return null;
            }
        }
    }

    public async Task<bool> UpdateStatusAsync(
        string sourceFile,
        string? destFile,
        MediaInfo? mediaInfo,
        FileStatus? status = null
    )
    {
        var scannedFile = await GetExistingScannedFileAsync(sourceFile, "update");
        if (scannedFile == null || mediaInfo == null)
        {
            return false;
        }

        try
        {
            // Use a transaction for the update to ensure atomicity
            await using var transaction = await dbContext.Database.BeginTransactionAsync();

            var hasChanges = false;

            // Only set properties that have changed
            if (destFile != null && destFile != scannedFile.DestFile)
            {
                scannedFile.DestFile = destFile;
                hasChanges = true;
            }
            if (mediaInfo.MediaType != scannedFile.MediaType)
            {
                scannedFile.MediaType = mediaInfo.MediaType;
                hasChanges = true;
            }
            if (mediaInfo.TmdbId != null && mediaInfo.TmdbId != scannedFile.TmdbId)
            {
                scannedFile.TmdbId = mediaInfo.TmdbId;
                hasChanges = true;
            }
            if (mediaInfo.ImdbId != null && mediaInfo.ImdbId != scannedFile.ImdbId)
            {
                scannedFile.ImdbId = mediaInfo.ImdbId;
                hasChanges = true;
            }
            if (
                mediaInfo.SeasonNumber != null
                && mediaInfo.SeasonNumber != scannedFile.SeasonNumber
            )
            {
                scannedFile.SeasonNumber = mediaInfo.SeasonNumber;
                hasChanges = true;
            }
            if (
                mediaInfo.EpisodeNumber != null
                && mediaInfo.EpisodeNumber != scannedFile.EpisodeNumber
            )
            {
                scannedFile.EpisodeNumber = mediaInfo.EpisodeNumber;
                hasChanges = true;
            }
            if (
                mediaInfo.EpisodeNumber2 != null
                && mediaInfo.EpisodeNumber2 != scannedFile.EpisodeNumber2
            )
            {
                scannedFile.EpisodeNumber2 = mediaInfo.EpisodeNumber2;
                hasChanges = true;
            }
            if (status.HasValue && status.Value != scannedFile.Status)
            {
                scannedFile.Status = status.Value;
                hasChanges = true;
            }

            if (mediaInfo.Genres != null)
            {
                var newGenresString = ScannedFileDto.ConvertGenresToString(mediaInfo.Genres);
                if (newGenresString != scannedFile.Genres)
                {
                    scannedFile.Genres = newGenresString;
                    hasChanges = true;
                }
            }
            if (mediaInfo.Title != null && mediaInfo.Title != scannedFile.Title)
            {
                scannedFile.Title = mediaInfo.Title;
                hasChanges = true;
            }

            if (mediaInfo.Year != null && mediaInfo.Year != scannedFile.Year)
            {
                scannedFile.Year = mediaInfo.Year;
                hasChanges = true;
            }

            // Only save if there are actual changes
            if (hasChanges)
            {
                try
                {
                    scannedFile.UpdatedAt = DateTime.UtcNow;
                    var saveResult = await dbContext.SaveChangesAsync();

                    // Check if we need to create a duplicate entry for EpisodeNumber2
                    if (scannedFile.EpisodeNumber2.HasValue)
                    {
                        var existingDuplicate = await dbContext.ScannedFiles.FirstOrDefaultAsync(
                            f =>
                                f.SourceFile == scannedFile.SourceFile
                                && f.EpisodeNumber == scannedFile.EpisodeNumber2
                        );

                        if (existingDuplicate == null)
                        {
                            var duplicateEntry = new ScannedFile
                            {
                                SourceFile = scannedFile.SourceFile,
                                DestFile = scannedFile.DestFile,
                                MediaType = scannedFile.MediaType,
                                Status = FileStatus.Success,
                                TmdbId = scannedFile.TmdbId,
                                ImdbId = scannedFile.ImdbId,
                                SeasonNumber = scannedFile.SeasonNumber,
                                EpisodeNumber = scannedFile.EpisodeNumber2,
                                EpisodeNumber2 = scannedFile.EpisodeNumber2,
                                Genres = scannedFile.Genres,
                                Title = scannedFile.Title,
                                Year = scannedFile.Year,
                                CreatedAt = DateTime.UtcNow,
                                UpdatedAt = DateTime.UtcNow,
                            };

                            await dbContext.ScannedFiles.AddAsync(duplicateEntry);
                            await dbContext.SaveChangesAsync();

                            // Notify clients about the new duplicate entry
                            await notificationService.NotifyFileAdded(duplicateEntry);
                        }
                    }

                    await transaction.CommitAsync();

                    if (saveResult > 0)
                    {
                        logger.LogInformation(
                            "Updated status to {Status} for file: {File}",
                            status,
                            sourceFile
                        );

                        // Notify clients about the update
                        await notificationService.NotifyFileUpdated(scannedFile);

                        return true;
                    }
                }
                catch (DbUpdateException ex)
                {
                    if (
                        ex.InnerException?.Message.Contains(
                            "UNIQUE constraint failed",
                            StringComparison.OrdinalIgnoreCase
                        ) != true
                    )
                    {
                        throw;
                    }
                    // Handle DestFile unique constraint violation

                    if (
                        !ex.InnerException.Message.Contains(
                            "DestFile",
                            StringComparison.OrdinalIgnoreCase
                        )
                    )
                    {
                        throw;
                    }
                    // Clear the dest file and mark as duplicate

                    scannedFile.DestFile = null;
                    scannedFile.Status = FileStatus.Duplicate;
                    scannedFile.UpdatedAt = DateTime.UtcNow;

                    await dbContext.SaveChangesAsync();
                    await transaction.CommitAsync();

#pragma warning disable S6667 // Logging in a catch clause should pass the caught exception as a parameter.

                    logger.LogInformation(
                        "Cleared DestFile and marked as duplicate for: {SourceFile}",
                        sourceFile
                    );
#pragma warning restore S6667 // Logging in a catch clause should pass the caught exception as a parameter.

                    await notificationService.NotifyFileUpdated(scannedFile);
                    return true;
                }
            }

            logger.LogDebug("No changes were needed for file: {File}", sourceFile);
            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error updating status for file: {File}", sourceFile);
            return false;
        }
    }

    public async Task<bool> UpdateStatusByTmdbIdAsync(int tmdbId, FileStatus status)
    {
        var scannedFiles = await GetByTmdbIdQuery(dbContext, tmdbId);

        if (scannedFiles.Count == 0)
        {
            logger.LogWarning("No files found for TMDb ID: {TmdbId}", tmdbId);
            return false;
        }

        try
        {
            // Use a transaction for batch update
            await using var transaction = await dbContext.Database.BeginTransactionAsync();

            var updateTime = DateTime.UtcNow;
            var hasChanges = false;

            foreach (var file in scannedFiles.Where(file => file.Status != status))
            {
                file.Status = status;
                file.UpdatedAt = updateTime;
                hasChanges = true;
            }

            if (hasChanges)
            {
                try
                {
                    var saveResult = await dbContext.SaveChangesAsync();
                    await transaction.CommitAsync();

                    if (saveResult > 0)
                    {
                        logger.LogInformation(
                            "Updated status to {Status} for {Count} files with TMDb ID: {TmdbId}",
                            status,
                            saveResult,
                            tmdbId
                        );
                        return true;
                    }
                }
                catch (DbUpdateException ex)
                {
                    if (
                        ex.InnerException?.Message.Contains(
                            "UNIQUE constraint failed",
                            StringComparison.OrdinalIgnoreCase
                        ) == true
                    )
                    {
                        // Since this is a batch update, handle each file individually if there's a constraint violation
                        foreach (var file in scannedFiles)
                        {
                            try
                            {
                                if (file.Status == status)
                                {
                                    continue;
                                }

                                file.Status = status;
                                file.UpdatedAt = updateTime;
                                await dbContext.SaveChangesAsync();
                            }
                            catch (DbUpdateException innerEx)
                            {
                                if (
                                    innerEx.InnerException?.Message.Contains(
                                        "UNIQUE constraint failed",
                                        StringComparison.OrdinalIgnoreCase
                                    ) == true
                                    && innerEx.InnerException.Message.Contains(
                                        "DestFile",
                                        StringComparison.OrdinalIgnoreCase
                                    )
                                )
                                {
                                    // Clear the dest file and mark as duplicate
                                    file.DestFile = null;
                                    file.Status = FileStatus.Duplicate;
                                    file.UpdatedAt = updateTime;
                                    await dbContext.SaveChangesAsync();
#pragma warning disable S6667 // Logging in a catch clause should pass the caught exception as a parameter.

                                    logger.LogInformation(
                                        "Cleared DestFile and marked as duplicate for file with TMDb ID: {TmdbId}",
                                        tmdbId
                                    );
#pragma warning restore S6667 // Logging in a catch clause should pass the caught exception as a parameter.
                                }
                                else
                                {
                                    throw;
                                }
                            }
                        }
                        await transaction.CommitAsync();
                        return true;
                    }
                    throw;
                }
            }

            logger.LogDebug("No status changes were needed for TMDb ID: {TmdbId}", tmdbId);
            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error updating status for TMDb ID: {TmdbId}", tmdbId);
            return false;
        }
    }
}
