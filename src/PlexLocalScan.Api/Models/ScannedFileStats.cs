using PlexLocalScan.Data.Models;

namespace PlexLocalScan.Api.Models;

public class ScannedFileStats
{
    public required int TotalFiles { get; init; }
    public required List<StatusCount> ByStatus { get; init; }
    public required List<MediaTypeCount> ByMediaType { get; init; }
}

public class StatusCount
{
    public required FileStatus Status { get; init; }
    public required int Count { get; init; }
}

public class MediaTypeCount
{
    public required MediaType MediaType { get; init; }
    public required int Count { get; init; }
} 