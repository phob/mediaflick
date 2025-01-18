using TMDbLib.Objects.General;
using TMDbLib.Objects.Movies;
using TMDbLib.Objects.Search;
using TMDbLib.Objects.TvShows;

namespace PlexLocalScan.Shared.TmDbMediaSearch.Interfaces;

public interface ITmDbClientWrapper
{
    Task<string?> GetImageUrl(string path, string size);
    Task<SearchContainer<SearchMovie>> SearchMovieAsync(string query);
    Task<SearchContainer<SearchTv>> SearchTvShowAsync(string query);
    Task<Movie> GetMovieAsync(int movieId);
    Task<TvShow> GetTvShowAsync(int tvShowId);
    Task<TvSeason> GetTvSeasonAsync(int tvShowId, int seasonNumber);
    Task<TvEpisode> GetTvEpisodeAsync(int tvShowId, int seasonNumber, int episodeNumber);
    Task<ExternalIdsTvShow> GetTvShowExternalIdsAsync(int tvShowId);
    Task<ExternalIdsMovie> GetMovieExternalIdsAsync(int movieId);
} 