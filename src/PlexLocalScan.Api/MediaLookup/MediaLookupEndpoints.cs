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
        ILogger<Program> logger
    )
    {
        logger.LogInformation("Getting movie info for TMDb ID: {TmdbId}", tmdbId);
        var movieInfo = await mediaLookupService.GetMovieMediaInfoAsync(tmdbId);

        return movieInfo is null ? TypedResults.NotFound() : TypedResults.Ok(movieInfo);
    }

    internal static async Task<Results<Ok<MediaInfo>, NotFound>> GetTvShowInfo(
        int tmdbId,
        IMediaSearchService mediaLookupService,
        ILogger<Program> logger
    )
    {
        logger.LogInformation("Getting TV show info for TMDb ID: {TmdbId}", tmdbId);
        var tvShowInfo = await mediaLookupService.GetTvShowMediaInfoAsync(tmdbId);

        return tvShowInfo is null ? TypedResults.NotFound() : TypedResults.Ok(tvShowInfo);
    }

    internal static async Task<Results<Ok<SeasonInfo>, NotFound>> GetTvSeasonInfo(
        int tmdbId,
        int seasonNumber,
        IMediaSearchService mediaLookupService,
        ILogger<Program> logger
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

        return tvSeasonInfo is null ? TypedResults.NotFound() : TypedResults.Ok(tvSeasonInfo);
    }

    internal static async Task<Results<Ok<EpisodeInfo>, NotFound>> GetTvEpisodeInfo(
        int tmdbId,
        int seasonNumber,
        int episodeNumber,
        IMediaSearchService mediaLookupService,
        ILogger<Program> logger
    )
    {
        logger.LogInformation(
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

        return tvEpisodeInfo is null ? TypedResults.NotFound() : TypedResults.Ok(tvEpisodeInfo);
    }
}
