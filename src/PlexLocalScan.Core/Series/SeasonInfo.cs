namespace PlexLocalScan.Core.Series;

public record SeasonInfo
{
    public int SeasonNumber { get; init; }
    public string? Name { get; init; }
    public string? Overview { get; init; }
    public string? PosterPath { get; init; }
    public DateTime? AirDate { get; init; }
    public List<EpisodeInfo> Episodes { get; init; } = [];
} 