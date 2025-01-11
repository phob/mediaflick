using PlexLocalScan.Shared.Interfaces;
using PlexLocalScan.Core.Media;
using PlexLocalScan.Core.Series;
using PlexLocalScan.Shared.Services;

namespace PlexLocalScan.Api.Controllers;

/// <summary>
/// Endpoint mappings for media lookup functionality
/// </summary>
internal static class MediaLookupEndpoints
{
    internal static async Task<IResult> SearchMovies(
        string title,
        IMediaSearchService mediaLookupService,
        ILogger<Program> logger)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            return Results.BadRequest("Title is required");
        }

        logger.LogInformation("Searching for movies with title: {Title}", title);
        IEnumerable<MediaSearchResult> results = await mediaLookupService.SearchMovieTmdbIdsAsync(title);
        return Results.Ok(results);
    }

    internal static async Task<IResult> SearchTvShows(
        string title,
        IMediaSearchService mediaLookupService,
        ILogger<Program> logger)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            return Results.BadRequest("Title is required");
        }

        logger.LogInformation("Searching for TV shows with title: {Title}", title);
        IEnumerable<MediaSearchResult> results = await mediaLookupService.SearchTvShowTmdbIdsAsync(title);
        return Results.Ok(results);
    }

    internal static async Task<IResult> GetMovieInfo(
        int tmdbId,
        IMediaSearchService mediaLookupService,
        ILogger<Program> logger)
    {
        logger.LogInformation("Getting movie info for TMDb ID: {TmdbId}", tmdbId);
        MediaInfo? movieInfo = await mediaLookupService.GetMovieMediaInfoAsync(tmdbId);
        
        return movieInfo is null ? Results.NotFound() : Results.Ok(movieInfo);
    }

    internal static async Task<IResult> GetTvShowInfo(
        int tmdbId,
        IMediaSearchService mediaLookupService,
        ILogger<Program> logger)
    {
        logger.LogInformation("Getting TV show info for TMDb ID: {TmdbId}", tmdbId);
        MediaInfo? tvShowInfo = await mediaLookupService.GetTvShowMediaInfoAsync(tmdbId);
        
        return tvShowInfo is null ? Results.NotFound() : Results.Ok(tvShowInfo);
    }

    internal static async Task<IResult> GetTvSeasonInfo(
        int tmdbId,
        int seasonNumber,
        IMediaSearchService mediaLookupService,
        ILogger<Program> logger)
    {
        logger.LogInformation("Getting TV season info for TMDb ID: {TmdbId}, Season Number: {SeasonNumber}", tmdbId, seasonNumber);
        SeasonInfo? tvSeasonInfo = await mediaLookupService.GetTvShowSeasonMediaInfoAsync(tmdbId, seasonNumber, includeDetails: true);

        return tvSeasonInfo is null ? Results.NotFound() : Results.Ok(tvSeasonInfo);
    }

    internal static async Task<IResult> GetTvEpisodeInfo(
        int tmdbId,
        int seasonNumber,
        int episodeNumber,
        IMediaSearchService mediaLookupService,
        ILogger<Program> logger)
    {
        logger.LogInformation("Getting TV episode info for TMDb ID: {TmdbId}, Season Number: {SeasonNumber}, Episode Number: {EpisodeNumber}", 
            tmdbId, seasonNumber, episodeNumber);
        EpisodeInfo? tvEpisodeInfo = await mediaLookupService.GetTvShowEpisodeMediaInfoAsync(tmdbId, seasonNumber, episodeNumber, includeDetails: true);

        return tvEpisodeInfo is null ? Results.NotFound() : Results.Ok(tvEpisodeInfo);
    }

    internal static async Task<IResult> GetImageUrl(
        IMediaSearchService mediaLookupService,
        string path,
        string size = "w500")
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            return Results.BadRequest("Path is required");
        }

        string? imageUrl = await mediaLookupService.GetImageUrlAsync(path, size);
        return imageUrl is null ? Results.NotFound() : Results.Redirect(imageUrl, permanent: true);
    }
} 
