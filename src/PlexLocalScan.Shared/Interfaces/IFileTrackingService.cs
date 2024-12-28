using PlexLocalScan.Data.Models;

namespace PlexLocalScan.Shared.Interfaces;

public interface IFileTrackingService
{
    Task<ScannedFile?> AddStatusAsync(string sourceFile, string? destFile, MediaType mediaType, int? tmdbId, string? imdbId, IEnumerable<string>? genres = null);
    Task<bool> UpdateStatusAsync(string sourceFile, string? destFile, MediaType? mediaType, int? tmdbId, string? imdbId, int? seasonNumber, int? episodeNumber, IEnumerable<string>? genres = null, string? title = null, int? year = null, FileStatus? status = null);
    Task<bool> UpdateStatusByTmdbIdAsync(int tmdbId, FileStatus status);
    Task<ScannedFile?> GetBySourceFileAsync(string sourceFile);
    Task<ScannedFile?> GetByDestFileAsync(string destFile);
} 