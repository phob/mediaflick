using PlexLocalScan.Api.Controllers;
using PlexLocalScan.Core.Media;
using PlexLocalScan.Core.Series;
using PlexLocalScan.Shared.Services;

namespace PlexLocalScan.Api.Routing;

internal static class MediaLookupRouting
{
    private const string MediaLookupBaseRoute = "api/medialookup";

    public static void MapMediaLookupEndpoints(this IEndpointRouteBuilder app)
    {
        RouteGroupBuilder group = app.MapGroup(MediaLookupBaseRoute)
            .WithTags("Media Lookup")
            .WithOpenApi()
            .WithDescription("Provides media lookup functionality using TMDb");

        MapMovieEndpoints(group);
        MapTvShowEndpoints(group);
        MapImageEndpoints(group);
    }

    private static void MapMovieEndpoints(RouteGroupBuilder group)
    {
        group.MapGet("movies/search", MediaLookupEndpoints.SearchMovies)
            .WithName("SearchMovies")
            .WithDescription("Searches for movies by title")
            .Produces<List<MediaSearchResult>>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest);

        group.MapGet("movies/{tmdbId}", MediaLookupEndpoints.GetMovieInfo)
            .WithName("GetMovieInfo")
            .WithDescription("Gets detailed information about a movie by TMDb ID")
            .Produces<MediaInfo>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound);
    }

    private static void MapTvShowEndpoints(RouteGroupBuilder group)
    {
        group.MapGet("tvshows/search", MediaLookupEndpoints.SearchTvShows)
            .WithName("SearchTvShows")
            .WithDescription("Searches for TV shows by title")
            .Produces<List<MediaSearchResult>>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest);

        group.MapGet("tvshows/{tmdbId}", MediaLookupEndpoints.GetTvShowInfo)
            .WithName("GetTvShowInfo")
            .WithDescription("Gets detailed information about a TV show by TMDb ID")
            .Produces<MediaInfo>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound);

        group.MapGet("tvshows/{tmdbId}/seasons/{seasonNumber}", MediaLookupEndpoints.GetTvSeasonInfo)
            .WithName("GetTvSeasonInfo")
            .WithDescription("Gets detailed information about a TV season by TMDb ID")
            .Produces<SeasonInfo>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound);

        group.MapGet("tvshows/{tmdbId}/seasons/{seasonNumber}/episodes/{episodeNumber}", MediaLookupEndpoints.GetTvEpisodeInfo)
            .WithName("GetTvEpisodeInfo")
            .WithDescription("Gets detailed information about a TV episode by TMDb ID")
            .Produces<EpisodeInfo>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status404NotFound);
    }

    private static void MapImageEndpoints(RouteGroupBuilder group) => group.MapGet("images/{*path}", MediaLookupEndpoints.GetImageUrl)
        .WithName("GetImageUrl")
        .WithDescription("Gets the URL for an image by TMDb path and size")
        .Produces<string>(StatusCodes.Status200OK)
        .Produces(StatusCodes.Status400BadRequest)
        .Produces(StatusCodes.Status404NotFound);
}
