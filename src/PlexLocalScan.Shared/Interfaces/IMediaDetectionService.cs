using PlexLocalScan.Data.Models;
using PlexLocalScan.Shared.Services;

namespace PlexLocalScan.Shared.Interfaces;

public interface IMediaDetectionService
{
    Task<MediaInfo?> DetectMediaAsync(string filePath, MediaType mediaType);
} 