using PlexLocalScan.Shared.TmDbMediaSearch.Interfaces;
using TMDbLib.Client;
using TMDbLib.Objects.General;
using TMDbLib.Objects.Movies;
using TMDbLib.Objects.Search;
using TMDbLib.Objects.TvShows;

namespace PlexLocalScan.Shared.TmDbMediaSearch.Services;

public sealed class TmDbClientWrapper(string apiKey) : ITmDbClientWrapper, IDisposable
{
    private readonly TMDbClient _client = new TMDbClient(apiKey);
    private const string BaseImageUrl = "https://image.tmdb.org/t/p/";
    private bool _disposed;
    private static readonly string[] ValidImageSizes = ["w92", "w154", "w185", "w342", "w500", "w780", "original"];

    public void Dispose()
    {
        Dispose(true);
        GC.SuppressFinalize(this);
    }

    private void Dispose(bool disposing)
    {
        if (_disposed)
        {
            return;
        }

        if (disposing)
        {
            _client.Dispose();
        }

        _disposed = true;
    }

    ~TMDbClientWrapper() => Dispose(false);

    public Task<string?> GetImageUrl(string path, string size)
    {
        if (string.IsNullOrEmpty(path))
        {
            return Task.FromResult<string?>(null);
        }

        static string FormatPath(string p) => p.StartsWith('/') ? p : '/' + p;
        static string ValidateSize(string s) => ValidImageSizes.Contains(s) ? s : "w500";

        return Task.FromResult<string?>($"{BaseImageUrl}{ValidateSize(size)}{FormatPath(path)}");
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
