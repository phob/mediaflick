using PlexLocalScan.Core.Media;
using PlexLocalScan.Core.Series;
using PlexLocalScan.Shared.TmDbMediaSearch.Services;

namespace PlexLocalScan.Api.MediaLookup;

internal static class MediaLookupRouting
{
    private const string MediaLookupBaseRoute = "api/medialookup";

    public static void MapMediaLookupEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup(MediaLookupBaseRoute)
            .WithTags("Media Lookup")
            .WithOpenApi()
            .WithDescription("Provides media lookup functionality using TMDb");

        MapMovieEndpoints(group);
        MapTvShowEndpoints(group);
        MapCacheManagementEndpoints(group);
    }

    private static void MapMovieEndpoints(RouteGroupBuilder group)
    {
        group
            .MapGet("movies/search", MediaLookupEndpoints.SearchMovies)
            .WithName("SearchMovies")
            .WithDescription("Searches for movies by title")
            .Produces<List<MediaSearchResult>>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest);

        group
            .MapGet("movies/{tmdbId}", MediaLookupEndpoints.GetMovieInfo)
            .WithName("GetMovieInfo")
            .WithDescription("Gets detailed information about a movie by TMDb ID")
            .Produces<MediaInfo>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound);
    }

    private static void MapTvShowEndpoints(RouteGroupBuilder group)
    {
        group
            .MapGet("tvshows/search", MediaLookupEndpoints.SearchTvShows)
            .WithName("SearchTvShows")
            .WithDescription("Searches for TV shows by title")
            .Produces<List<MediaSearchResult>>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest);

        group
            .MapGet("tvshows/{tmdbId}", MediaLookupEndpoints.GetTvShowInfo)
            .WithName("GetTvShowInfo")
            .WithDescription("Gets detailed information about a TV show by TMDb ID")
            .Produces<MediaInfo>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound);

        group
            .MapGet("tvshows/{tmdbId}/seasons/{seasonNumber}", MediaLookupEndpoints.GetTvSeasonInfo)
            .WithName("GetTvSeasonInfo")
            .WithDescription("Gets detailed information about a TV season by TMDb ID")
            .Produces<SeasonInfo>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound);

        group
            .MapGet(
                "tvshows/{tmdbId}/seasons/{seasonNumber}/episodes/{episodeNumber}",
                MediaLookupEndpoints.GetTvEpisodeInfo
            )
            .WithName("GetTvEpisodeInfo")
            .WithDescription("Gets detailed information about a TV episode by TMDb ID")
            .Produces<EpisodeInfo>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound);
    }

    private static void MapCacheManagementEndpoints(RouteGroupBuilder group)
    {
        var cacheGroup = group.MapGroup("cache")
            .WithTags("Cache Management")
            .WithDescription("Cache management operations");

        cacheGroup
            .MapDelete("movies/{tmdbId}", CacheManagementEndpoints.InvalidateMovieCache)
            .WithName("InvalidateMovieCache")
            .WithDescription("Invalidates cache for a specific movie")
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status500InternalServerError);

        cacheGroup
            .MapDelete("tvshows/{tmdbId}", CacheManagementEndpoints.InvalidateTvShowCache)
            .WithName("InvalidateTvShowCache")
            .WithDescription("Invalidates cache for a specific TV show")
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status500InternalServerError);

        cacheGroup
            .MapDelete("search", CacheManagementEndpoints.InvalidateSearchCache)
            .WithName("InvalidateSearchCache")
            .WithDescription("Invalidates search cache for a specific title and media type")
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status500InternalServerError);

        cacheGroup
            .MapGet("stats", CacheManagementEndpoints.GetCacheStats)
            .WithName("GetCacheStats")
            .WithDescription("Gets cache statistics and information")
            .Produces<object>(StatusCodes.Status200OK);
    }
}
