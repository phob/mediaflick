using PlexLocalScan.Core.Media;
using PlexLocalScan.Core.Tables;

namespace PlexLocalScan.Shared.MediaDetection.Interfaces;

public interface IMediaDetectionService
{
    Task<MediaInfo?> DetectMediaAsync(string filePath, MediaType mediaType);
} 