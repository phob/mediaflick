using TMDbLib.Objects.General;
using TMDbLib.Objects.Search;
using TMDbLib.Objects.TvShows;
using TMDbLib.Client;
using PlexLocalScan.Shared.Interfaces;

public class TMDbClientWrapper : ITMDbClientWrapper
{
    private readonly TMDbClient _client;

    public TMDbClientWrapper(string apiKey)
    {
        _client = new TMDbClient(apiKey);
    }

    public Task<SearchContainer<SearchMovie>> SearchMovieAsync(string query)
        => _client.SearchMovieAsync(query);

    public Task<SearchContainer<SearchTv>> SearchTvShowAsync(string query)
        => _client.SearchTvShowAsync(query);

    public Task<TvEpisode> GetTvEpisodeAsync(int tvShowId, int seasonNumber, int episodeNumber)
        => _client.GetTvEpisodeAsync(tvShowId, seasonNumber, episodeNumber);
} 