using PlexLocalScan.Shared.Services;

namespace PlexLocalScan.Shared.Interfaces;

public interface IMovieDetectionService
{
    Task<MediaInfo?> DetectMovieAsync(string fileName, string filePath);
    Task<MediaInfo?> DetectMovieByTmdbIdAsync(int tmdbId);
} 