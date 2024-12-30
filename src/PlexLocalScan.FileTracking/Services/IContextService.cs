using PlexLocalScan.Core.Tables;

namespace PlexLocalScan.FileTracking.Services;

public interface IContextService
{
    Task<ScannedFile?> AddStatusAsync(string sourceFile, string? destFile, MediaType mediaType);
    Task<bool> UpdateStatusAsync(string sourceFile, string? destFile, MediaType? mediaType, int? tmdbId, string? imdbId, int? seasonNumber, int? episodeNumber, IEnumerable<string>? genres = null, string? title = null, int? year = null, FileStatus? status = null);
    Task<bool> UpdateStatusByTmdbIdAsync(int tmdbId, FileStatus status);
} 