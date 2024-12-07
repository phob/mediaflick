using TMDbLib.Objects.General;
using TMDbLib.Objects.Search;
using TMDbLib.Objects.TvShows;
using TMDbLib.Objects.Movies;
using TMDbLib.Client;
using PlexLocalScan.Shared.Interfaces;

public class TMDbClientWrapper(string apiKey) : ITMDbClientWrapper
{
    private readonly TMDbClient _client = new(apiKey);
    private const string BaseImageUrl = "https://image.tmdb.org/t/p/";

    public Task<string> GetImageUrl(string path, string size)
    {
        if (string.IsNullOrEmpty(path)) return Task.FromResult<string>(null);
        
        // Ensure path starts with /
        path = path.StartsWith("/") ? path : "/" + path;
        
        // Validate size parameter
        var validSizes = new[] { "w92", "w154", "w185", "w342", "w500", "w780", "original" };
        size = validSizes.Contains(size) ? size : "w500";

        return Task.FromResult($"{BaseImageUrl}{size}{path}");
    }

    public Task<SearchContainer<SearchMovie>> SearchMovieAsync(string query)
        => _client.SearchMovieAsync(query);

    public Task<SearchContainer<SearchTv>> SearchTvShowAsync(string query)
        => _client.SearchTvShowAsync(query);

    public Task<Movie> GetMovieAsync(int movieId)
        => _client.GetMovieAsync(movieId, MovieMethods.Images | MovieMethods.Credits);
    
    public Task<TvShow> GetTvShowAsync(int tvShowId)
        => _client.GetTvShowAsync(tvShowId, TvShowMethods.Images | TvShowMethods.Credits);

    public Task<TvSeason> GetTvSeasonAsync(int tvShowId, int seasonNumber)
        => _client.GetTvSeasonAsync(tvShowId, seasonNumber, TvSeasonMethods.Images | TvSeasonMethods.Credits);

    public Task<TvEpisode> GetTvEpisodeAsync(int tvShowId, int seasonNumber, int episodeNumber)
        => _client.GetTvEpisodeAsync(tvShowId, seasonNumber, episodeNumber);

    public Task<ExternalIdsTvShow> GetTvShowExternalIdsAsync(int tvShowId)
        => _client.GetTvShowExternalIdsAsync(tvShowId);

    public Task<ExternalIdsMovie> GetMovieExternalIdsAsync(int movieId)
        => _client.GetMovieExternalIdsAsync(movieId);
} 