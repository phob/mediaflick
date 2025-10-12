using PlexLocalScan.Core.Tables;

namespace PlexLocalScan.Api.ScannedFiles.Models;

#pragma warning disable CA1515 // Consider making public types internal
public sealed class ScannedFileFilter
#pragma warning restore CA1515 // Consider making public types internal
{
    public string? SearchTerm { get; init; }
    public FileStatus? Status { get; init; }
    public MediaType? MediaType { get; init; }
    public string? SortBy { get; init; }
    public string? SortOrder { get; init; }
}
