using System.ComponentModel.DataAnnotations;

namespace PlexLocalScan.Core.Tables;

public class ScannedFile
{
    [Key]
    public int Id { get; init; }

    [Required]
    public string SourceFile { get; init; } = string.Empty;
    public string? DestFile { get; set; } = string.Empty;
    public long? FileSize { get; set; }
    public string? FileHash { get; set; }
    public MediaType? MediaType { get; set; }
    public int? TmdbId { get; set; }
    public string? ImdbId { get; set; }
    public string? Title { get; set; }
    public int? Year { get; set; }
    public string? Genres { get; set; }
    public int? SeasonNumber { get; set; }
    public int? EpisodeNumber { get; set; }
    public int? EpisodeNumber2 { get; set; }

    [Required]
    public FileStatus Status { get; set; }

    public DateTime CreatedAt { get; init; } = DateTime.UtcNow;

    public DateTime? UpdatedAt { get; set; }

    [Required]
    public int VersionUpdated { get; set; } = 0;

    [Required]
    public int UpdateToVersion { get; set; } = 0;
}

public enum FileStatus
{
    Processing,
    Success,
    Failed,
    Duplicate,
}

public enum MediaType
{
    Movies,
    TvShows,
    Extras,
    Unknown,
}
