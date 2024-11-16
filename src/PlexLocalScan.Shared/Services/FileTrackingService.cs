using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PlexLocalScan.Data.Models;
using PlexLocalScan.Data.Data;
using PlexLocalScan.Shared.Interfaces;

namespace PlexLocalScan.Shared.Services;

public class FileTrackingService : IFileTrackingService
{
    private readonly PlexScanContext _context;
    private readonly ILogger<FileTrackingService> _logger;

    public FileTrackingService(PlexScanContext context, ILogger<FileTrackingService> logger)
    {
        _context = context;
        _logger = logger;
    }


    public async Task<ScannedFile> TrackFileAsync(string sourceFile, string? destFile, MediaType mediaType, int? tmdbId)
    {
        var scannedFile = new ScannedFile
        {
            SourceFile = sourceFile,
            DestFile = destFile,
            MediaType = mediaType,
            TmdbId = tmdbId,
            Status = FileStatus.Working
        };

        _context.ScannedFiles.Add(scannedFile);
        await _context.SaveChangesAsync();
        
        _logger.LogInformation("Tracked new file: {SourceFile} -> {DestFile}", sourceFile, destFile);
        return scannedFile;
    }
    public async Task<bool> UpdateStatusAsync(string sourceFile, string? destFile, MediaType? mediaType, int? tmdbId, FileStatus status)
    {
        var scannedFile = await _context.ScannedFiles
            .FirstOrDefaultAsync(f => f.SourceFile == sourceFile);  

        if (scannedFile == null)
        {
            _logger.LogWarning("File not found for status update: {File}", sourceFile);
            return false;
        }

        try
        {
            if (destFile != null) scannedFile.DestFile = destFile;
            if (mediaType.HasValue) scannedFile.MediaType = mediaType.Value;
            if (tmdbId.HasValue) scannedFile.TmdbId = tmdbId.Value;
            scannedFile.Status = status;
            scannedFile.UpdatedAt = DateTime.UtcNow;

            // Explicitly mark the entity as modified
            _context.Entry(scannedFile).State = EntityState.Modified;
            
            var saveResult = await _context.SaveChangesAsync();
            
            if (saveResult > 0)
            {
                _logger.LogInformation("Updated status to {Status} for file: {File}", status, sourceFile);
                return true;
            }
            
            _logger.LogWarning("No changes were saved to database for file: {File}", sourceFile);
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating status for file: {File}", sourceFile);
            throw;
        }
    }

    public async Task<bool> UpdateStatusByTmdbIdAsync(int tmdbId, FileStatus status)
    {
        var scannedFiles = await _context.ScannedFiles
            .Where(f => f.TmdbId == tmdbId)
            .ToListAsync();

        if (!scannedFiles.Any())
        {
            _logger.LogWarning("No files found for TMDb ID: {TmdbId}", tmdbId);
            return false;
        }

        try
        {
            foreach (var file in scannedFiles)
            {
                file.Status = status;
                file.UpdatedAt = DateTime.UtcNow;
                // Explicitly mark each entity as modified
                _context.Entry(file).State = EntityState.Modified;
            }

            var saveResult = await _context.SaveChangesAsync();
            
            if (saveResult > 0)
            {
                _logger.LogInformation("Updated status to {Status} for {Count} files with TMDb ID: {TmdbId}", 
                    status, scannedFiles.Count, tmdbId);
                return true;
            }
            
            _logger.LogWarning("No changes were saved to database for TMDb ID: {TmdbId}", tmdbId);
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating status for TMDb ID: {TmdbId}", tmdbId);
            throw;
        }
    }

    public async Task<ScannedFile?> GetBySourceFileAsync(string sourceFile)
        => await _context.ScannedFiles.FirstOrDefaultAsync(f => f.SourceFile == sourceFile);

    public async Task<ScannedFile?> GetByDestFileAsync(string destFile)
        => await _context.ScannedFiles.FirstOrDefaultAsync(f => f.DestFile == destFile);
}