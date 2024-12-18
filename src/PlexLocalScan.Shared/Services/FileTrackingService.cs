using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PlexLocalScan.Data.Models;
using PlexLocalScan.Data.Data;
using PlexLocalScan.Shared.Interfaces;

namespace PlexLocalScan.Shared.Services;

public class FileTrackingService(
    PlexScanContext dbContext,
    ILogger<FileTrackingService> logger,
    IFileTrackingNotificationService notificationService)
    : IFileTrackingService
{
    // Compiled queries for better performance
    private static readonly Func<PlexScanContext, string, Task<ScannedFile?>> GetBySourceFileQuery =
        EF.CompileAsyncQuery((PlexScanContext context, string sourceFile) =>
            context.ScannedFiles.FirstOrDefault(f => f.SourceFile == sourceFile));
            
    private static readonly Func<PlexScanContext, string, Task<ScannedFile?>> GetByDestFileQuery =
        EF.CompileAsyncQuery((PlexScanContext context, string destFile) =>
            context.ScannedFiles.FirstOrDefault(f => f.DestFile == destFile));
            
    private static readonly Func<PlexScanContext, int, Task<List<ScannedFile>>> GetByTmdbIdQuery =
        EF.CompileAsyncQuery((PlexScanContext context, int tmdbId) =>
            context.ScannedFiles.Where(f => f.TmdbId == tmdbId).ToList());

    private async Task<ScannedFile?> GetExistingScannedFileAsync(string sourceFile, string? type = null)
    {
        var scannedFile = await GetBySourceFileQuery(dbContext, sourceFile);

        if (scannedFile == null) return null;
        if (scannedFile.Status == FileStatus.Success && type == "add")
        {
            logger.LogInformation("File already tracked and successful: {SourceFile}", sourceFile);
            return scannedFile;
        }
        logger.LogDebug("File already tracked: {SourceFile}", sourceFile);

        return scannedFile;
    }

    public async Task<ScannedFile?> AddStatusAsync(string sourceFile, string? destFile, MediaType mediaType, int? tmdbId, string? imdbId)
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
            TmdbId = tmdbId,
            ImdbId = imdbId,
            Status = FileStatus.Processing,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await dbContext.ScannedFiles.AddAsync(scannedFile);
        
        try
        {
            await dbContext.SaveChangesAsync();
            logger.LogInformation("Tracked new file: {SourceFile} -> {DestFile}", sourceFile, destFile);
            
            // Notify clients about the new file
            await notificationService.NotifyFileAdded(scannedFile);
            
            return scannedFile;
        }
        catch (DbUpdateException ex)
        {
            logger.LogError(ex, "Error adding file to tracking: {SourceFile}", sourceFile);
            // Check if it was a concurrency issue - another process might have added the file
            var existingFile = await GetExistingScannedFileAsync(sourceFile, "add");
            return existingFile;
        }
    }

    public async Task<bool> UpdateStatusAsync(string sourceFile, string? destFile, MediaType? mediaType, int? tmdbId, string? imdbId, FileStatus status)
    {
        return await UpdateStatusAsync(sourceFile, destFile, mediaType, tmdbId, imdbId, null, null, status);
    }

    public async Task<bool> UpdateStatusAsync(string sourceFile, string? destFile, MediaType? mediaType, int? tmdbId, string? imdbId, int? seasonNumber, int? episodeNumber, FileStatus status)
    {
        var scannedFile = await GetExistingScannedFileAsync(sourceFile, "update");
        if (scannedFile == null)
        {
            return false;
        }

        try
        {
            // Use a transaction for the update to ensure atomicity
            await using var transaction = await dbContext.Database.BeginTransactionAsync();
            
            bool hasChanges = false;
            
            // Only set properties that have changed
            if (destFile != null && destFile != scannedFile.DestFile)
            {
                scannedFile.DestFile = destFile;
                hasChanges = true;
            }
            if (mediaType.HasValue && mediaType.Value != scannedFile.MediaType)
            {
                scannedFile.MediaType = mediaType.Value;
                hasChanges = true;
            }
            if (tmdbId.HasValue && tmdbId.Value != scannedFile.TmdbId)
            {
                scannedFile.TmdbId = tmdbId.Value;
                hasChanges = true;
            }
            if (imdbId != null && imdbId != scannedFile.ImdbId)
            {
                scannedFile.ImdbId = imdbId;
                hasChanges = true;
            }
            if (seasonNumber.HasValue && seasonNumber.Value != scannedFile.SeasonNumber)
            {
                scannedFile.SeasonNumber = seasonNumber.Value;
                hasChanges = true;
            }
            if (episodeNumber.HasValue && episodeNumber.Value != scannedFile.EpisodeNumber)
            {
                scannedFile.EpisodeNumber = episodeNumber.Value;
                hasChanges = true;
            }
            if (status != scannedFile.Status)
            {
                scannedFile.Status = status;
                scannedFile.UpdatedAt = DateTime.UtcNow;
                hasChanges = true;
            }

            // Only save if there are actual changes
            if (hasChanges)
            {
                var saveResult = await dbContext.SaveChangesAsync();
                await transaction.CommitAsync();
                
                if (saveResult > 0)
                {
                    logger.LogInformation("Updated status to {Status} for file: {File}", status, sourceFile);
                    
                    // Notify clients about the update
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
            throw;
        }
    }

    public async Task<bool> UpdateStatusByTmdbIdAsync(int tmdbId, FileStatus status)
    {
        var scannedFiles = await GetByTmdbIdQuery(dbContext, tmdbId);

        if (!scannedFiles.Any())
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
            
            foreach (var file in scannedFiles)
            {
                if (file.Status != status)
                {
                    file.Status = status;
                    file.UpdatedAt = updateTime;
                    hasChanges = true;
                }
            }

            if (hasChanges)
            {
                var saveResult = await dbContext.SaveChangesAsync();
                await transaction.CommitAsync();
                
                if (saveResult > 0)
                {
                    logger.LogInformation("Updated status to {Status} for {Count} files with TMDb ID: {TmdbId}", 
                        status, saveResult, tmdbId);
                    return true;
                }
            }
            
            logger.LogDebug("No status changes were needed for TMDb ID: {TmdbId}", tmdbId);
            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error updating status for TMDb ID: {TmdbId}", tmdbId);
            throw;
        }
    }

    public async Task<ScannedFile?> GetBySourceFileAsync(string sourceFile)
    {
        return await GetBySourceFileQuery(dbContext, sourceFile);
    }

    public async Task<ScannedFile?> GetByDestFileAsync(string destFile)
    {
        return await GetByDestFileQuery(dbContext, destFile);
    }
}