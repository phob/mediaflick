using TMDbLib.Objects.General;
using TMDbLib.Objects.Search;
using TMDbLib.Objects.TvShows;

namespace PlexLocalScan.Shared.Interfaces;

public interface ITMDbClientWrapper
{
    Task<SearchContainer<SearchMovie>> SearchMovieAsync(string query);
    Task<SearchContainer<SearchTv>> SearchTvShowAsync(string query);
    Task<TvEpisode> GetTvEpisodeAsync(int tvShowId, int seasonNumber, int episodeNumber);
} 