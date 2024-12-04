using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Caching.Memory;
using PlexLocalScan.Data.Models;
using PlexLocalScan.Data.Data;
using PlexLocalScan.Shared.Interfaces;

namespace PlexLocalScan.Shared.Services;

public class FileTrackingService(
    PlexScanContext dbContext,
    ILogger<FileTrackingService> logger)
    : IFileTrackingService
{

    private async Task<ScannedFile?> GetExistingScannedFileAsync(string sourceFile, string? type = null)
    {
        var scannedFile = await dbContext.ScannedFiles
            .FirstOrDefaultAsync(f => f.SourceFile == sourceFile);

        if (scannedFile != null)
        {
            if (scannedFile.Status == FileStatus.Success && type == "add")
            {
                logger.LogInformation("File already tracked and successful: {SourceFile}", sourceFile);
                return null;
            }
            logger.LogDebug("File already tracked: {SourceFile}", sourceFile);
        }

        return scannedFile;
    }
    public async Task<ScannedFile?> AddStatusAsync(string sourceFile, string? destFile, MediaType mediaType, int? tmdbId)
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
            Status = FileStatus.Processing
        };

        dbContext.ScannedFiles.Add(scannedFile);
        await dbContext.SaveChangesAsync();
        
        logger.LogInformation("Tracked new file: {SourceFile} -> {DestFile}", sourceFile, destFile);
        return scannedFile;
    }

    public async Task<bool> UpdateStatusAsync(string sourceFile, string? destFile, MediaType? mediaType, int? tmdbId, FileStatus status)
    {
        return await UpdateStatusAsync(sourceFile, destFile, mediaType, tmdbId, null, null, status);
    }

    public async Task<bool> UpdateStatusAsync(string sourceFile, string? destFile, MediaType? mediaType, int? tmdbId, int? seasonNumber, int? episodeNumber, FileStatus status)
    {
        var scannedFile = await GetExistingScannedFileAsync(sourceFile, "update");
        if (scannedFile == null)
        {
            return false;
        }

        try
        {
            if (destFile != null) scannedFile.DestFile = destFile;
            if (mediaType.HasValue) scannedFile.MediaType = mediaType.Value;
            if (tmdbId.HasValue) scannedFile.TmdbId = tmdbId.Value;
            if (seasonNumber.HasValue) scannedFile.SeasonNumber = seasonNumber.Value;
            if (episodeNumber.HasValue) scannedFile.EpisodeNumber = episodeNumber.Value;
            scannedFile.Status = status;
            scannedFile.UpdatedAt = DateTime.UtcNow;

            dbContext.Entry(scannedFile).State = EntityState.Modified;
            var saveResult = await dbContext.SaveChangesAsync();
            
            if (saveResult > 0)
            {
                logger.LogInformation("Updated status to {Status} for file: {File}", status, sourceFile);
                return true;
            }
            
            logger.LogWarning("No changes were saved to database for file: {File}", sourceFile);
            return false;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error updating status for file: {File}", sourceFile);
            throw;
        }
    }

    public async Task<bool> UpdateStatusByTmdbIdAsync(int tmdbId, FileStatus status)
    {
        var scannedFiles =  await dbContext.ScannedFiles
                .Where(f => f.TmdbId == tmdbId)
                .ToListAsync();

        if (scannedFiles.Count == 0)
        {
            logger.LogWarning("No files found for TMDb ID: {TmdbId}", tmdbId);
            return false;
        }

        try
        {
            foreach (var file in scannedFiles)
            {
                file.Status = status;
                file.UpdatedAt = DateTime.UtcNow;
                dbContext.Entry(file).State = EntityState.Modified;
            }

            var saveResult = await dbContext.SaveChangesAsync();
            
            if (saveResult > 0)
            {
                logger.LogInformation("Updated status to {Status} for {Count} files with TMDb ID: {TmdbId}", 
                    status, scannedFiles.Count, tmdbId);
                return true;
            }
            
            logger.LogWarning("No changes were saved to database for TMDb ID: {TmdbId}", tmdbId);
            return false;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error updating status for TMDb ID: {TmdbId}", tmdbId);
            throw;
        }
    }

    public async Task<ScannedFile?> GetBySourceFileAsync(string sourceFile)
    {
        return await dbContext.ScannedFiles.FirstOrDefaultAsync(f => f.SourceFile == sourceFile);
    }

    public async Task<ScannedFile?> GetByDestFileAsync(string destFile)
    {
        return await dbContext.ScannedFiles.FirstOrDefaultAsync(f => f.DestFile == destFile);
    }
}