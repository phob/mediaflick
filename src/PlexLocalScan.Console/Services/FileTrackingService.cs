using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PlexLocalScan.Data;
using PlexLocalScan.Models;
using PlexLocalScan.Options;
namespace PlexLocalScan.Services;

public interface IFileTrackingService
{
    Task<ScannedFile> TrackFileAsync(string sourceFile, string destFile, MediaType mediaType, int? tmdbId);
    Task<bool> UpdateStatusAsync(string file, FileStatus status);
    Task<bool> UpdateStatusByTmdbIdAsync(int tmdbId, FileStatus status);
    Task<ScannedFile?> GetBySourceFileAsync(string sourceFile);
    Task<ScannedFile?> GetByDestFileAsync(string destFile);
}

public class FileTrackingService : IFileTrackingService
{
    private readonly PlexScanContext _context;
    private readonly ILogger<FileTrackingService> _logger;

    public FileTrackingService(PlexScanContext context, ILogger<FileTrackingService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<ScannedFile> TrackFileAsync(string sourceFile, string destFile, MediaType mediaType, int? tmdbId)
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

    public async Task<bool> UpdateStatusAsync(string file, FileStatus status)
    {
        var scannedFile = await _context.ScannedFiles
            .FirstOrDefaultAsync(f => f.SourceFile == file || f.DestFile == file);

        if (scannedFile == null)
        {
            _logger.LogWarning("File not found for status update: {File}", file);
            return false;
        }

        scannedFile.Status = status;
        scannedFile.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        
        _logger.LogInformation("Updated status to {Status} for file: {File}", status, file);
        return true;
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

        foreach (var file in scannedFiles)
        {
            file.Status = status;
            file.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync();
        _logger.LogInformation("Updated status to {Status} for {Count} files with TMDb ID: {TmdbId}", 
            status, scannedFiles.Count, tmdbId);
        return true;
    }

    public async Task<ScannedFile?> GetBySourceFileAsync(string sourceFile)
        => await _context.ScannedFiles.FirstOrDefaultAsync(f => f.SourceFile == sourceFile);

    public async Task<ScannedFile?> GetByDestFileAsync(string destFile)
        => await _context.ScannedFiles.FirstOrDefaultAsync(f => f.DestFile == destFile);
} 