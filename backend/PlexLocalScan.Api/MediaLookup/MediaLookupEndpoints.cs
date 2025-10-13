using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Http.HttpResults;
using PlexLocalScan.Core.Media;
using PlexLocalScan.Core.Series;
using PlexLocalScan.Shared.TmDbMediaSearch.Interfaces;
using PlexLocalScan.Shared.TmDbMediaSearch.Services;

namespace PlexLocalScan.Api.MediaLookup;

/// <summary>
/// Endpoint handlers for media lookup functionality
/// </summary>
internal static class MediaLookupEndpoints
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = false,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Converters = { new JsonStringEnumConverter() },
    };

    internal static async Task<
        Results<Ok<List<MediaSearchResult>>, ProblemHttpResult>
    > SearchMovies(string title, IMediaSearchService mediaLookupService, ILogger<Program> logger)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            return TypedResults.Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "Validation Error",
                detail: "Title is required"
            );
        }

        logger.LogInformation("Searching for movies with title: {Title}", title);
        var results = await mediaLookupService.SearchMovieTmdbIdsAsync(title);
        return TypedResults.Ok(results.ToList());
    }

    internal static async Task<
        Results<Ok<List<MediaSearchResult>>, ProblemHttpResult>
    > SearchTvShows(string title, IMediaSearchService mediaLookupService, ILogger<Program> logger)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            return TypedResults.Problem(
                statusCode: StatusCodes.Status400BadRequest,
                title: "Validation Error",
                detail: "Title is required"
            );
        }

        logger.LogInformation("Searching for TV shows with title: {Title}", title);
        var results = await mediaLookupService.SearchTvShowTmdbIdsAsync(title);
        return TypedResults.Ok(results.ToList());
    }

    internal static async Task<Results<Ok<MediaInfo>, NotFound>> GetMovieInfo(
        int tmdbId,
        IMediaSearchService mediaLookupService,
        ILogger<Program> logger,
        HttpContext context
    )
    {
        logger.LogDebug("Getting movie info for TMDb ID: {TmdbId}", tmdbId);
        var movieInfo = await mediaLookupService.GetMovieMediaInfoAsync(tmdbId);

        if (movieInfo is null)
            return TypedResults.NotFound();

        // Set cache headers for 24 hours - movie data rarely changes
        context.Response.Headers.CacheControl = "public, max-age=86400"; // 24 hours
        context.Response.Headers.ETag = $"\"{tmdbId}\"";
        
        return TypedResults.Ok(movieInfo);
    }

    internal static async Task<Results<Ok<MediaInfo>, NotFound>> GetTvShowInfo(
        int tmdbId,
        IMediaSearchService mediaLookupService,
        ILogger<Program> logger,
        HttpContext context
    )
    {
        logger.LogDebug("Getting TV show info for TMDb ID: {TmdbId}", tmdbId);
        var tvShowInfo = await mediaLookupService.GetTvShowMediaInfoAsync(tmdbId);

        if (tvShowInfo is null)
            return TypedResults.NotFound();

        // Set cache headers for 6 hours - TV show episode counts can change
        context.Response.Headers.CacheControl = "public, max-age=21600"; // 6 hours
        context.Response.Headers.ETag = $"\"{tmdbId}\"";
        
        return TypedResults.Ok(tvShowInfo);
    }

    internal static async Task<Results<Ok<SeasonInfo>, NotFound>> GetTvSeasonInfo(
        int tmdbId,
        int seasonNumber,
        IMediaSearchService mediaLookupService,
        ILogger<Program> logger,
        HttpContext context
    )
    {
        logger.LogInformation(
            "Getting TV season info for TMDb ID: {TmdbId}, Season Number: {SeasonNumber}",
            tmdbId,
            seasonNumber
        );

        var tvSeasonInfo = await mediaLookupService.GetTvShowSeasonMediaInfoAsync(
            tmdbId,
            seasonNumber,
            includeDetails: true
        );

        if (tvSeasonInfo is null)
            return TypedResults.NotFound();

        // Set cache headers for 2 hours - season scan status can change
        context.Response.Headers.CacheControl = "public, max-age=7200"; // 2 hours
        context.Response.Headers.ETag = $"\"{tmdbId}_{seasonNumber}\"";
        
        return TypedResults.Ok(tvSeasonInfo);
    }

    internal static async Task<Results<Ok<EpisodeInfo>, NotFound>> GetTvEpisodeInfo(
        int tmdbId,
        int seasonNumber,
        int episodeNumber,
        IMediaSearchService mediaLookupService,
        ILogger<Program> logger,
        HttpContext context
    )
    {
        logger.LogDebug(
            "Getting TV episode info for TMDb ID: {TmdbId}, Season Number: {SeasonNumber}, Episode Number: {EpisodeNumber}",
            tmdbId,
            seasonNumber,
            episodeNumber
        );

        var tvEpisodeInfo = await mediaLookupService.GetTvShowEpisodeMediaInfoAsync(
            tmdbId,
            seasonNumber,
            episodeNumber,
            includeDetails: true
        );

        if (tvEpisodeInfo is null)
            return TypedResults.NotFound();

        // Set cache headers for 2 hours - episode data is relatively stable
        context.Response.Headers.CacheControl = "public, max-age=7200"; // 2 hours
        context.Response.Headers.ETag = $"\"{tmdbId}_{seasonNumber}_{episodeNumber}\"";
        
        return TypedResults.Ok(tvEpisodeInfo);
    }
}
