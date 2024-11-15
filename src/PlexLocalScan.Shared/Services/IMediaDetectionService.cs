using PlexLocalScan.Data.Models;
namespace PlexLocalScan.Shared.Services;

public interface IMediaDetectionService
{
    Task<MediaInfo?> DetectMediaAsync(string filePath, MediaType mediaType);
}

public class MediaInfo
{
    public string Title { get; set; } = string.Empty;
    public int? Year { get; set; }
    public int? TmdbId { get; set; }
    public MediaType MediaType { get; set; }
    public int? SeasonNumber { get; set; }
    public int? EpisodeNumber { get; set; }
    public string? EpisodeTitle { get; set; }
    public int? EpisodeNumber2 { get; internal set; }
    public int? EpisodeTmdbId { get; internal set; }
} 