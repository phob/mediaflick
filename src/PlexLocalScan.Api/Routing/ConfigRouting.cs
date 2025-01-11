using Microsoft.Extensions.Options;
using PlexLocalScan.Api.Controllers;
using PlexLocalScan.Shared.Options;

namespace PlexLocalScan.Api.Routing;

internal static class ConfigRouting
{
    private const string ConfigBaseRoute = "api/config";

    public static void MapConfigEndpoints(this IEndpointRouteBuilder app)
    {
        RouteGroupBuilder group = app.MapGroup(ConfigBaseRoute)
            .WithTags("Configuration")
            .WithOpenApi()
            .WithDescription("Manages configuration settings for the application");

        group.MapGet("/", 
                (IOptions<PlexOptions> plexOptions, IOptions<TmDbOptions> tmdbOptions, IOptions<MediaDetectionOptions> mediaDetectionOptions) => 
                    ConfigController.GetAllConfigurations(plexOptions, tmdbOptions, mediaDetectionOptions))
            .WithName("GetAllConfigurations")
            .WithDescription("Gets all configuration settings")
            .Produces<object>(StatusCodes.Status200OK);

        group.MapGet("plex", 
                (IOptions<PlexOptions> plexOptions) => 
                    ConfigController.GetPlexConfig(plexOptions))
            .WithName("GetPlexConfig")
            .WithDescription("Gets Plex configuration settings")
            .Produces<PlexOptions>(StatusCodes.Status200OK);

        group.MapGet("tmdb", 
                (IOptions<TmDbOptions> tmdbOptions) => 
                    ConfigController.GetTMDbConfig(tmdbOptions))
            .WithName("GetTMDbConfig")
            .WithDescription("Gets TMDb configuration settings")
            .Produces<TmDbOptions>(StatusCodes.Status200OK);

        group.MapGet("media-detection", 
                (IOptions<MediaDetectionOptions> mediaDetectionOptions) => 
                    ConfigController.GetMediaDetectionConfig(mediaDetectionOptions))
            .WithName("GetMediaDetectionConfig")
            .WithDescription("Gets media detection configuration settings")
            .Produces<MediaDetectionOptions>(StatusCodes.Status200OK);
    }
}
