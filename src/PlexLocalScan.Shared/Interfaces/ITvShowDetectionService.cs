using PlexLocalScan.Shared.Services;

namespace PlexLocalScan.Shared.Interfaces;

public interface ITvShowDetectionService
{
    Task<MediaInfo?> DetectTvShowAsync(string fileName, string filePath);
} 