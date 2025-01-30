using System.Text.Json;
using System.Text.Json.Serialization;
using PlexLocalScan.Shared.TmDbMediaSearch.Interfaces;

namespace PlexLocalScan.Api.MediaLookup;

/// <summary>
/// Endpoint mappings for media lookup functionality
/// </summary>
internal static class MediaLookupEndpoints
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = false,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Converters = { new JsonStringEnumConverter() },
    };

    internal static async Task<IResult> SearchMovies(
        string title,
        IMediaSearchService mediaLookupService,
        ILogger<Program> logger
    )
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            return Results.BadRequest("Title is required");
        }

        logger.LogInformation("Searching for movies with title: {Title}", title);
        var results = await mediaLookupService.SearchMovieTmdbIdsAsync(title);
        var json = JsonSerializer.Serialize(results, JsonOptions);
        return Results.Text(json, "application/json");
    }

    internal static async Task<IResult> SearchTvShows(
        string title,
        IMediaSearchService mediaLookupService,
        ILogger<Program> logger
    )
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            return Results.BadRequest("Title is required");
        }

        logger.LogInformation("Searching for TV shows with title: {Title}", title);
        var results = await mediaLookupService.SearchTvShowTmdbIdsAsync(title);
        var json = JsonSerializer.Serialize(results, JsonOptions);
        return Results.Text(json, "application/json");
    }

    internal static async Task<IResult> GetMovieInfo(
        int tmdbId,
        IMediaSearchService mediaLookupService,
        ILogger<Program> logger
    )
    {
        logger.LogInformation("Getting movie info for TMDb ID: {TmdbId}", tmdbId);
        var movieInfo = await mediaLookupService.GetMovieMediaInfoAsync(tmdbId);

        if (movieInfo is null)
        {
            return TypedResults.NotFound();
        }

        var json = JsonSerializer.Serialize(movieInfo, JsonOptions);
        return Results.Text(json, "application/json");
    }

    internal static async Task<IResult> GetTvShowInfo(
        int tmdbId,
        IMediaSearchService mediaLookupService,
        ILogger<Program> logger
    )
    {
        logger.LogInformation("Getting TV show info for TMDb ID: {TmdbId}", tmdbId);
        var tvShowInfo = await mediaLookupService.GetTvShowMediaInfoAsync(tmdbId);

        if (tvShowInfo is null)
        {
            return TypedResults.NotFound();
        }

        var json = JsonSerializer.Serialize(tvShowInfo, JsonOptions);
        return Results.Text(json, "application/json");
    }

    internal static async Task<IResult> GetTvSeasonInfo(
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

        if (tvSeasonInfo is null)
        {
            return TypedResults.NotFound();
        }

        var json = JsonSerializer.Serialize(tvSeasonInfo, JsonOptions);
        return Results.Text(json, "application/json");
    }

    internal static async Task<IResult> GetTvEpisodeInfo(
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

        if (tvEpisodeInfo is null)
        {
            return TypedResults.NotFound();
        }

        var json = JsonSerializer.Serialize(tvEpisodeInfo, JsonOptions);
        return Results.Text(json, "application/json");
    }
}
