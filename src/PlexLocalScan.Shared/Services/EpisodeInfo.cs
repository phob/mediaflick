public record EpisodeInfo
{
    public int EpisodeNumber { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Overview { get; init; }
    public string? StillPath { get; init; }
    public DateTime? AirDate { get; init; }
    public int? TmdbId { get; init; }
} 