using PlexLocalScan.Data.Models;

namespace PlexLocalScan.Shared.Models;

public class ScannedFileDto
{
    public int Id { get; init; }
    public string SourceFile { get; init; } = string.Empty;
    public string? DestFile { get; set; }
    public string? MediaType { get; set; }
    public int? TmdbId { get; set; }
    public string? ImdbId { get; set; }
    public int? SeasonNumber { get; set; }
    public int? EpisodeNumber { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; init; }
    public DateTime? UpdatedAt { get; set; }
    public int VersionUpdated { get; set; }
    public int UpdateToVersion { get; set; }

    public static ScannedFileDto FromScannedFile(ScannedFile file)
    {
        return new ScannedFileDto
        {
            Id = file.Id,
            SourceFile = file.SourceFile,
            DestFile = file.DestFile,
            MediaType = file.MediaType?.ToString(),
            TmdbId = file.TmdbId,
            ImdbId = file.ImdbId,
            SeasonNumber = file.SeasonNumber,
            EpisodeNumber = file.EpisodeNumber,
            Status = file.Status.ToString(),
            CreatedAt = file.CreatedAt,
            UpdatedAt = file.UpdatedAt,
            VersionUpdated = file.VersionUpdated,
            UpdateToVersion = file.UpdateToVersion
        };
    }
} 