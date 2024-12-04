using PlexLocalScan.Data.Models;
using PlexLocalScan.Shared.Interfaces;
using Microsoft.Extensions.Logging;

namespace PlexLocalScan.Shared.Services;

public record MediaSearchResult(int TmdbId, string Title, int? Year);

public class MediaLookupService : IMediaLookupService
{
    private readonly ITMDbClientWrapper _tmdbClient;
    private readonly ILogger<MediaLookupService> _logger;

    public MediaLookupService(ITMDbClientWrapper tmdbClient, ILogger<MediaLookupService> logger)
    {
        _tmdbClient = tmdbClient;
        _logger = logger;
    }

    public async Task<IEnumerable<MediaSearchResult>> SearchMovieTmdbIdsAsync(string title)
    {
        var searchResults = await _tmdbClient.SearchMovieAsync(title);
        return searchResults.Results.Select(r => new MediaSearchResult(r.Id, r.Title, r.ReleaseDate?.Year)).ToList();
    }

    public async Task<IEnumerable<MediaSearchResult>> SearchTvShowTmdbIdsAsync(string title)
    {
        _logger.LogInformation("Searching for TV show with title: {Title}", title);
        var searchResults = await _tmdbClient.SearchTvShowAsync(title);
        
        if (searchResults == null)
        {
            _logger.LogWarning("SearchTvShowAsync returned null");
            return Enumerable.Empty<MediaSearchResult>();
        }

        if (searchResults.Results == null)
        {
            _logger.LogWarning("SearchTvShowAsync results collection is null");
            return Enumerable.Empty<MediaSearchResult>();
        }

        var results = searchResults.Results.Select(r => new MediaSearchResult(r.Id, r.Name, r.FirstAirDate?.Year)).ToList();
        _logger.LogInformation("Found {Count} TV show results", results.Count);
        
        return results;
    }

    public async Task<MediaInfo?> GetMovieMediaInfoAsync(int tmdbId)
    {
        var movie = await _tmdbClient.GetMovieAsync(tmdbId);
        if (movie != null)
        {
            var mediaInfo = new MediaInfo
            {
                Title = movie.Title,
                Year = movie.ReleaseDate?.Year,
                TmdbId = movie.Id,
                MediaType = MediaType.Movies,
                PosterPath = movie.PosterPath,
                Summary = movie.Overview
            };
            return mediaInfo;
        }
        return null;
    }

    public async Task<MediaInfo?> GetTvShowMediaInfoAsync(int tmdbId)
    {
        var tvShow = await _tmdbClient.GetTvShowAsync(tmdbId);
        if (tvShow != null)
        {
            var mediaInfo = new MediaInfo
            {
                Title = tvShow.Name,
                Year = tvShow.FirstAirDate?.Year,
                TmdbId = tvShow.Id,
                MediaType = MediaType.TvShows,
                PosterPath = tvShow.PosterPath,
                Summary = tvShow.Overview
            };
            return mediaInfo;
        }
        return null;
    }
}