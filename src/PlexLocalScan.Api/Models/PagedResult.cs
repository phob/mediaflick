namespace PlexLocalScan.Api.Models;

public class PagedResult<T>
{
    public required IEnumerable<T> Items { get; init; }
    public required int TotalItems { get; init; }
    public required int Page { get; init; }
    public required int PageSize { get; init; }
    public required int TotalPages { get; init; }
} 