using TMDbLib.Objects.General;
using TMDbLib.Objects.Search;
using TMDbLib.Objects.TvShows;
using TMDbLib.Objects.Movies;
using TMDbLib.Client;
using PlexLocalScan.Shared.Interfaces;

public class TMDbClientWrapper(string apiKey) : ITMDbClientWrapper
{
    private readonly TMDbClient _client = new(apiKey);

    public Task<SearchContainer<SearchMovie>> SearchMovieAsync(string query)
        => _client.SearchMovieAsync(query);

    public Task<SearchContainer<SearchTv>> SearchTvShowAsync(string query)
        => _client.SearchTvShowAsync(query);

    public Task<TvEpisode> GetTvEpisodeAsync(int tvShowId, int seasonNumber, int episodeNumber)
        => _client.GetTvEpisodeAsync(tvShowId, seasonNumber, episodeNumber);

    public Task<Movie> GetMovieAsync(int movieId)
        => _client.GetMovieAsync(movieId);
    
    public Task<TvShow> GetTvShowAsync(int tvShowId)
        => _client.GetTvShowAsync(tvShowId);
} 