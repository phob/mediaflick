namespace PlexLocalScan.Core.Series;

public record SeasonInfo
{
    public int SeasonNumber { get; init; }
    public string? Name { get; set; }
    public string? Overview { get; set; }
    public string? PosterPath { get; set; }
    public DateTime? AirDate { get; set; }
    public List<EpisodeInfo> Episodes { get; init; } = [];
} 