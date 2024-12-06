using TMDbLib.Objects.General;
using TMDbLib.Objects.Search;
using TMDbLib.Objects.TvShows;
using TMDbLib.Objects.Movies;

namespace PlexLocalScan.Shared.Interfaces;

public interface ITMDbClientWrapper
{
    Task<SearchContainer<SearchMovie>> SearchMovieAsync(string query);
    Task<SearchContainer<SearchTv>> SearchTvShowAsync(string query);
    Task<TvEpisode> GetTvEpisodeAsync(int tvShowId, int seasonNumber, int episodeNumber);
    Task<Movie> GetMovieAsync(int movieId);
    Task<TvShow> GetTvShowAsync(int tvShowId);
    Task<ExternalIdsTvShow> GetExternalIdsAsync(int tvShowId);
    Task<ExternalIdsMovie> GetMovieExternalIdsAsync(int movieId);
} 