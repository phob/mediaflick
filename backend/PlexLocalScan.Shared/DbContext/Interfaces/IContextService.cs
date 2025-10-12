using PlexLocalScan.Core.Media;
using PlexLocalScan.Core.Tables;

namespace PlexLocalScan.Shared.DbContext.Interfaces;

public interface IContextService
{
    Task<ScannedFile?> AddStatusAsync(
        string sourceFile,
        string? destFile,
        MediaType mediaType,
        long? fileSize,
        string? fileHash
    );
    Task<bool> UpdateStatusAsync(
        string sourceFile,
        string? destFile,
        MediaInfo? mediaInfo,
        FileStatus? status = null
    );
    Task<bool> UpdateStatusByTmdbIdAsync(int tmdbId, FileStatus status);
}
