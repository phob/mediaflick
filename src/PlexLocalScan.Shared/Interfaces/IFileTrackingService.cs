using PlexLocalScan.Data.Models;

namespace PlexLocalScan.Shared.Interfaces;

public interface IFileTrackingService
{
    Task<ScannedFile?> AddStatusAsync(string sourceFile, string? destFile, MediaType mediaType, int? tmdbId, string? imdbId);
    Task<bool> UpdateStatusAsync(string sourceFile, string? destFile, MediaType? mediaType, int? tmdbId, string? imdbId, FileStatus? status);
    Task<bool> UpdateStatusAsync(string sourceFile, string? destFile, MediaType? mediaType, int? tmdbId, string? imdbId, int? seasonNumber, int? episodeNumber, FileStatus? status);
    Task<bool> UpdateStatusByTmdbIdAsync(int tmdbId, FileStatus status);
} 