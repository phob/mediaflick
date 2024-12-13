using System.ComponentModel.DataAnnotations;


namespace PlexLocalScan.Data.Models;

public class ScannedFile
{
    [Key]
    public int Id { get; init; }
    
    [Required]
    public string SourceFile { get; init; } = string.Empty;
    
    public string? DestFile { get; set; } = string.Empty;
    
    public MediaType? MediaType { get; set; } = null;
    
    public int? TmdbId { get; set; } = null;
    public string? ImdbId { get; set; } = null;

    public int? SeasonNumber { get; set; } = null;
    public int? EpisodeNumber { get; set; } = null;
    
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
    Duplicate
}

public enum MediaType
{
    Movies,
    TvShows,
    Extras,
    Unknown
}