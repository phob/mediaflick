using PlexLocalScan.Core.Tables;

namespace PlexLocalScan.Api.Models;

#pragma warning disable CA1515 // Consider making public types internal
public sealed class UpdateScannedFileRequest
#pragma warning restore CA1515 // Consider making public types internal
{
    public int? TmdbId { get; init; }
    public int? SeasonNumber { get; init; }
    public int? EpisodeNumber { get; init; }
    public int? EpisodeNumber2 { get; init; }
    public MediaType? MediaType { get; init; }
}
