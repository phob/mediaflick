using PlexLocalScan.Shared.Services;

namespace PlexLocalScan.Shared.Interfaces;

public interface IMediaLookupService
{
    Task<IEnumerable<MediaSearchResult>> SearchMovieTmdbIdsAsync(string title);
    Task<IEnumerable<MediaSearchResult>> SearchTvShowTmdbIdsAsync(string title);
    Task<MediaInfo?> GetMovieMediaInfoAsync(int tmdbId);
    Task<MediaInfo?> GetTvShowMediaInfoAsync(int tmdbId);
}