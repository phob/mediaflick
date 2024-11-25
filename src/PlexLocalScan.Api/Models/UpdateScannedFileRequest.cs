using System.ComponentModel.DataAnnotations;

namespace PlexLocalScan.Api.Models;

public class UpdateScannedFileRequest
{
    public int? TmdbId { get; init; }
    public int? SeasonNumber { get; init; }
    public int? EpisodeNumber { get; init; }
} 