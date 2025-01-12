using PlexLocalScan.Shared.Interfaces;
using PlexLocalScan.Core.Media;
using PlexLocalScan.Core.Series;
using PlexLocalScan.Shared.Services;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace PlexLocalScan.Api.Controllers;

/// <summary>
/// Endpoint mappings for media lookup functionality
/// </summary>
internal static class MediaLookupEndpoints
{
    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        WriteIndented = false,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Converters = { new JsonStringEnumConverter() }
    };

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
        string json = JsonSerializer.Serialize(results, _jsonOptions);
        return Results.Text(json, "application/json");
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
        string json = JsonSerializer.Serialize(results, _jsonOptions);
        return Results.Text(json, "application/json");
    }

    internal static async Task<IResult> GetMovieInfo(
        int tmdbId,
        IMediaSearchService mediaLookupService,
        ILogger<Program> logger)
    {
        logger.LogInformation("Getting movie info for TMDb ID: {TmdbId}", tmdbId);
        MediaInfo? movieInfo = await mediaLookupService.GetMovieMediaInfoAsync(tmdbId);
        
        if (movieInfo is null)
        {
            return TypedResults.NotFound();
        }

        string json = JsonSerializer.Serialize(movieInfo, _jsonOptions);
        return Results.Text(json, "application/json");
    }

    internal static async Task<IResult> GetTvShowInfo(
        int tmdbId,
        IMediaSearchService mediaLookupService,
        ILogger<Program> logger)
    {
        logger.LogInformation("Getting TV show info for TMDb ID: {TmdbId}", tmdbId);
        MediaInfo? tvShowInfo = await mediaLookupService.GetTvShowMediaInfoAsync(tmdbId);
        
        if (tvShowInfo is null)
        {
            return TypedResults.NotFound();
        }

        string json = JsonSerializer.Serialize(tvShowInfo, _jsonOptions);
        return Results.Text(json, "application/json");
    }

    internal static async Task<IResult> GetTvSeasonInfo(
        int tmdbId,
        int seasonNumber,
        IMediaSearchService mediaLookupService,
        ILogger<Program> logger)
    {
        logger.LogInformation("Getting TV season info for TMDb ID: {TmdbId}, Season Number: {SeasonNumber}", tmdbId, seasonNumber);
        SeasonInfo? tvSeasonInfo = await mediaLookupService.GetTvShowSeasonMediaInfoAsync(tmdbId, seasonNumber, includeDetails: true);

        if (tvSeasonInfo is null)
        {
            return TypedResults.NotFound();
        }

        string json = JsonSerializer.Serialize(tvSeasonInfo, _jsonOptions);
        return Results.Text(json, "application/json");
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

        if (tvEpisodeInfo is null)
        {
            return TypedResults.NotFound();
        }

        string json = JsonSerializer.Serialize(tvEpisodeInfo, _jsonOptions);
        return Results.Text(json, "application/json");
    }
} 
