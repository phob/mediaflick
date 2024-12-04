using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using PlexLocalScan.Data.Models;
using PlexLocalScan.Shared.Interfaces;

namespace PlexLocalScan.Shared.Services;

public class MediaLookupService(
    ILogger<TvShowDetectionService> logger,
    ITMDbClientWrapper tmdbClient,
    IMemoryCache cache) : IMediaLookupService
{
    public async Task<List<(int TmdbId, string Title)>> SearchMovieTmdbIdsAsync(string title)
    {
        var searchResults = await tmdbClient.SearchMovieAsync(title);
        return searchResults.Results.Select(r => (r.Id, r.Title)).ToList();
    }

    public async Task<List<(int TmdbId, string Title)>> SearchTvShowTmdbIdsAsync(string title)
    {
        var searchResults = await tmdbClient.SearchTvShowAsync(title);
        return searchResults.Results.Select(r => (r.Id, r.Name)).ToList();
    }

    public async Task<MediaInfo?> GetMovieMediaInfoAsync(int tmdbId)
    {
        var movie = await tmdbClient.GetMovieAsync(tmdbId);
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
        var tvShow = await tmdbClient.GetTvShowAsync(tmdbId);
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