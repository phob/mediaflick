using PlexLocalScan.Core.Tables;

namespace PlexLocalScan.Api.Models;

#pragma warning disable CA1515 // Consider making public types internal
public sealed class ScannedFileStats
#pragma warning restore CA1515 // Consider making public types internal
{
    public required int TotalFiles { get; init; }
    public required ICollection<StatusCount> ByStatus { get; init; }
    public required ICollection<MediaTypeCount> ByMediaType { get; init; }
}

#pragma warning disable CA1515 // Consider making public types internal
public sealed class StatusCount
#pragma warning restore CA1515 // Consider making public types internal
{
    public required FileStatus Status { get; init; }
    public required int Count { get; init; }
}

#pragma warning disable CA1515 // Consider making public types internal
public sealed class MediaTypeCount
#pragma warning restore CA1515 // Consider making public types internal
{
    public required MediaType MediaType { get; init; }
    public required int Count { get; init; }
} 