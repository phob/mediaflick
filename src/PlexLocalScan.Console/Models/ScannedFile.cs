using System.ComponentModel.DataAnnotations;
using PlexLocalScan.Console.Options;

namespace PlexLocalScan.Console.Models;

public class ScannedFile
{
    [Key]
    public int Id { get; set; }
    
    [Required]
    public string SourceFile { get; set; } = string.Empty;
    
    [Required]
    public string DestFile { get; set; } = string.Empty;
    
    [Required]
    public MediaType MediaType { get; set; }
    
    public int? TmdbId { get; set; }
    
    [Required]
    public FileStatus Status { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    public DateTime? UpdatedAt { get; set; }
}

public enum FileStatus
{
    Working,
    Success,
    Failed
} 