using PlexLocalScan.Data.Models;

namespace PlexLocalScan.Shared.Interfaces;

public interface IFileTrackingService
{
    Task<ScannedFile?> AddStatusAsync(string sourceFile, string? destFile, MediaType mediaType, int? tmdbId);
    Task<bool> UpdateStatusAsync(string sourceFile, string? destFile, MediaType? mediaType, int? tmdbId, FileStatus status);
    Task<bool> UpdateStatusByTmdbIdAsync(int tmdbId, FileStatus status);
} 