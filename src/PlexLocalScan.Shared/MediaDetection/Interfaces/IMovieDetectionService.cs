using PlexLocalScan.Core.Media;

namespace PlexLocalScan.Shared.MediaDetection.Interfaces;

public interface IMovieDetectionService
{
    Task<MediaInfo> DetectMovieAsync(string fileName, string filePath);
    Task<MediaInfo> DetectMovieByTmdbIdAsync(int tmdbId);
}
