using PlexLocalScan.Data.Models;

namespace PlexLocalScan.Shared.Models.Media;

public record MediaInfo
{
    public string Title { get; init; } = string.Empty;
    public int? Year { get; init; }
    public int? TmdbId { get; init; }
    public string? ImdbId { get; init; }
    public List<string>? Genres { get; init; }
    public MediaType MediaType { get; init; }
    public int? SeasonNumber { get; init; }
    public int? EpisodeNumber { get; init; }
    public string? EpisodeTitle { get; init; }
    public int? EpisodeNumber2 { get; internal init; }
    public int? EpisodeTmdbId { get; internal set; }
    public string? PosterPath { get; internal set; }
    public string? Summary { get; internal set; }
    public string? Status { get; internal set; }
    public List<SeasonInfo> Seasons { get; init; } = [];
} 