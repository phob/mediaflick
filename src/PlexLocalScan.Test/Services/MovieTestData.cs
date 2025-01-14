namespace PlexLocalScan.Test.Services;

internal sealed record MovieTestData
{
    public required string FileName { get; init; }
    public required string Title { get; init; }
    public required int TmdbId { get; init; }
    public required string ImdbId { get; init; }
    public required int Year { get; init; }
    public required DateTime ReleaseDate { get; init; }
    public double Popularity { get; init; } = 90.0;
} 