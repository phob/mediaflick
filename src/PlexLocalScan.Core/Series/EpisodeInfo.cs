namespace PlexLocalScan.Core.Series;

public record EpisodeInfo
{
    public int EpisodeNumber { get; init; }
    public string? Name { get; set; }
    public string? Overview { get; set; }
    public string? StillPath { get; set; }
    public DateTime? AirDate { get; set; }
    public bool IsScanned { get; set; }
}
