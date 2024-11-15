using PlexLocalScan.Data.Models;
using PlexLocalScan.Shared.Options;

namespace PlexLocalScan.Shared.Services;

public interface IFileTrackingService
{
    Task<ScannedFile> TrackFileAsync(string sourceFile, string? destFile, MediaType mediaType, int? tmdbId);
    Task<bool> UpdateStatusAsync(string sourceFile, string? destFile, MediaType? mediaType, int? tmdbId, FileStatus status);
    Task<bool> UpdateStatusByTmdbIdAsync(int tmdbId, FileStatus status);
    Task<ScannedFile?> GetBySourceFileAsync(string sourceFile);
    Task<ScannedFile?> GetByDestFileAsync(string destFile);
}
