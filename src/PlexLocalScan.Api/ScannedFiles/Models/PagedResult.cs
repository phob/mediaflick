namespace PlexLocalScan.Api.ScannedFiles.Models;

#pragma warning disable CA1515 // Consider making public types internal
public sealed class PagedResult<T>
#pragma warning restore CA1515 // Consider making public types internal
{
    public required IEnumerable<T> Items { get; init; }
    public required int TotalItems { get; init; }
    public required int Page { get; init; }
    public required int PageSize { get; init; }
    public required int TotalPages { get; init; }
}
