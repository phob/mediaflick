using PlexLocalScan.Core.Media;

namespace PlexLocalScan.Shared.Interfaces;

public interface ITvShowDetectionService
{
    Task<MediaInfo> DetectTvShowAsync(string fileName, string filePath);
    Task<MediaInfo> DetectTvShowByTmdbIdAsync(int tmdbId, int season, int episode);
} 
