using PlexLocalScan.Core.Tables;

namespace PlexLocalScan.Api.Models;

public class ScannedFileFilter
{
    public string? SearchTerm { get; init; }
    public FileStatus? Status { get; init; }
    public MediaType? MediaType { get; init; }
    public string? SortBy { get; init; }
    public string? SortOrder { get; init; }
} 