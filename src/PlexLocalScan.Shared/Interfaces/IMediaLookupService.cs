namespace PlexLocalScan.Shared.Services;

public interface IMediaLookupService
{
    Task<List<(int TmdbId, string Title)>> SearchMovieTmdbIdsAsync(string title);
    Task<List<(int TmdbId, string Title)>> SearchTvShowTmdbIdsAsync(string title);
    Task<MediaInfo?> GetMovieMediaInfoAsync(int tmdbId);
    Task<MediaInfo?> GetTvShowMediaInfoAsync(int tmdbId);
}