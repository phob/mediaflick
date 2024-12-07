using PlexLocalScan.Data.Models;
using PlexLocalScan.Shared.Models.Media;

namespace PlexLocalScan.Shared.Interfaces;

public interface IMediaDetectionService
{
    Task<MediaInfo?> DetectMediaAsync(string filePath, MediaType mediaType);
} 