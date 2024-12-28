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
    private const string GENRE_SEPARATOR = "|";
    
    private static string? ConvertGenresToString(IEnumerable<string>? genres)
        => genres?.Any() == true ? string.Join(GENRE_SEPARATOR, genres) : null;
    
    private static IEnumerable<string>? ConvertStringToGenres(string? genresString)
        => !string.IsNullOrWhiteSpace(genresString) 
            ? genresString.Split(GENRE_SEPARATOR, StringSplitOptions.RemoveEmptyEntries) 
            : null;

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

    public async Task<ScannedFile?> AddStatusAsync(string sourceFile, string? destFile, MediaType mediaType, int? tmdbId, string? imdbId, IEnumerable<string>? genres = null)
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
            Genres = ConvertGenresToString(genres),
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
            
            // Check if it's a unique constraint violation
            if (ex.InnerException?.Message.Contains("UNIQUE constraint failed") == true)
            {
                // Try to determine which constraint failed
                if (ex.InnerException.Message.Contains("SourceFile"))
                {
                    // Source file conflict - just return the existing file
                    return await GetExistingScannedFileAsync(sourceFile, "add");
                }
                else if (ex.InnerException.Message.Contains("DestFile"))
                {
                    // Dest file conflict - clear the dest file and mark as duplicate
                    scannedFile.DestFile = null;
                    scannedFile.Status = FileStatus.Duplicate;
                    
                    try
                    {
                        await dbContext.SaveChangesAsync();
                        logger.LogInformation("Cleared DestFile and marked as duplicate for: {SourceFile}", sourceFile);
                        await notificationService.NotifyFileAdded(scannedFile);
                        return scannedFile;
                    }
                    catch (Exception retryEx)
                    {
                        logger.LogError(retryEx, "Error saving file after clearing DestFile: {SourceFile}", sourceFile);
                        throw;
                    }
                }
            }
            
            // For other types of exceptions or if we can't determine the constraint
            // Check if it was a concurrency issue - another process might have added the file
            return await GetExistingScannedFileAsync(sourceFile, "add");
        }
    }

    public async Task<bool> UpdateStatusAsync(string sourceFile, string? destFile, MediaType? mediaType, int? tmdbId, string? imdbId, IEnumerable<string>? genres = null, FileStatus? status = null)
    {
        return await UpdateStatusAsync(sourceFile, destFile, mediaType, tmdbId, imdbId, null, null, genres, status);
    }

    public async Task<bool> UpdateStatusAsync(string sourceFile, string? destFile, MediaType? mediaType, int? tmdbId, string? imdbId, int? seasonNumber, int? episodeNumber, 
        IEnumerable<string>? genres = null, FileStatus? status = null)
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
            if (status.HasValue && status.Value != scannedFile.Status)
            {
                scannedFile.Status = status.Value;
                hasChanges = true;
            }

            if (genres != null)
            {
                var newGenresString = ConvertGenresToString(genres);
                if (newGenresString != scannedFile.Genres)
                {
                    scannedFile.Genres = newGenresString;
                    hasChanges = true;
                }
            }

            // Only save if there are actual changes
            if (hasChanges)
            {
                try
                {
                    scannedFile.UpdatedAt = DateTime.UtcNow;
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
                catch (DbUpdateException ex)
                {
                    if (ex.InnerException?.Message.Contains("UNIQUE constraint failed") == true)
                    {
                        // Handle DestFile unique constraint violation
                        if (ex.InnerException.Message.Contains("DestFile"))
                        {
                            // Clear the dest file and mark as duplicate
                            scannedFile.DestFile = null;
                            scannedFile.Status = FileStatus.Duplicate;
                            scannedFile.UpdatedAt = DateTime.UtcNow;
                            
                            await dbContext.SaveChangesAsync();
                            await transaction.CommitAsync();
                            
                            logger.LogInformation("Cleared DestFile and marked as duplicate for: {SourceFile}", sourceFile);
                            await notificationService.NotifyFileUpdated(scannedFile);
                            return true;
                        }
                    }
                    throw;
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
                try 
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
                catch (DbUpdateException ex)
                {
                    if (ex.InnerException?.Message.Contains("UNIQUE constraint failed") == true)
                    {
                        // Since this is a batch update, handle each file individually if there's a constraint violation
                        foreach (var file in scannedFiles)
                        {
                            try
                            {
                                if (file.Status != status)
                                {
                                    file.Status = status;
                                    file.UpdatedAt = updateTime;
                                    await dbContext.SaveChangesAsync();
                                }
                            }
                            catch (DbUpdateException innerEx)
                            {
                                if (innerEx.InnerException?.Message.Contains("UNIQUE constraint failed") == true 
                                    && innerEx.InnerException.Message.Contains("DestFile"))
                                {
                                    // Clear the dest file and mark as duplicate
                                    file.DestFile = null;
                                    file.Status = FileStatus.Duplicate;
                                    file.UpdatedAt = updateTime;
                                    await dbContext.SaveChangesAsync();
                                    logger.LogInformation("Cleared DestFile and marked as duplicate for file with TMDb ID: {TmdbId}", tmdbId);
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