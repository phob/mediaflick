using Microsoft.Extensions.Options;
using Microsoft.AspNetCore.Mvc;
using PlexLocalScan.Api.Controllers;
using PlexLocalScan.Shared.Options;
using PlexLocalScan.Api.Config;

namespace PlexLocalScan.Api.Routing;

internal static class ConfigRouting
{
    private const string ConfigBaseRoute = "api/config";

    public static void MapConfigEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup(ConfigBaseRoute)
            .WithTags("Configuration")
            .WithOpenApi()
            .WithDescription("Manages configuration settings for the application");

        group.MapGet("/", 
                (IOptionsSnapshot<PlexOptions> plexOptions, IOptionsSnapshot<TmDbOptions> tmdbOptions, IOptionsSnapshot<MediaDetectionOptions> mediaDetectionOptions) => 
                    ConfigController.GetAllConfigurations(plexOptions, tmdbOptions, mediaDetectionOptions))
            .WithName("GetAllConfigurations")
            .WithDescription("Gets all configuration settings")
            .Produces<object>(StatusCodes.Status200OK);

        group.MapGet("plex", 
                (IOptionsSnapshot<PlexOptions> plexOptions) => 
                    ConfigController.GetPlexConfig(plexOptions))
            .WithName("GetPlexConfig")
            .WithDescription("Gets Plex configuration settings")
            .Produces<PlexOptions>(StatusCodes.Status200OK);

        group.MapPut("plex", async Task<IResult> ([FromBody] PlexOptions config, YamlConfigurationService configService) =>
            {
                if (config == null) return Results.BadRequest("Configuration cannot be null");
                if (string.IsNullOrEmpty(config.Host)) return Results.BadRequest("Host is required");
                if (config.Port <= 0) return Results.BadRequest("Port must be greater than 0");
                if (config.FolderMappings == null || config.FolderMappings.Count == 0) 
                    return Results.BadRequest("At least one folder mapping is required");

                foreach (var mapping in config.FolderMappings)
                {
                    if (string.IsNullOrEmpty(mapping.SourceFolder)) 
                        return Results.BadRequest("Source folder is required for all mappings");
                    if (string.IsNullOrEmpty(mapping.DestinationFolder)) 
                        return Results.BadRequest("Destination folder is required for all mappings");
                }

                return await ConfigController.SetPlexConfig(configService, config);
            })
            .WithName("SetPlexConfig")
            .WithDescription("Updates Plex configuration settings")
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest);

        group.MapGet("tmdb", 
                (IOptionsSnapshot<TmDbOptions> tmdbOptions) => 
                    ConfigController.GetTMDbConfig(tmdbOptions))
            .WithName("GetTMDbConfig")
            .WithDescription("Gets TMDb configuration settings")
            .Produces<TmDbOptions>(StatusCodes.Status200OK);

        group.MapPut("tmdb", async Task<IResult> ([FromBody] TmDbOptions config, YamlConfigurationService configService) =>
            {
                if (config == null) return Results.BadRequest("Configuration cannot be null");
                return await ConfigController.SetTmDbConfig(configService, config);
            })
            .WithName("SetTMDbConfig")
            .WithDescription("Updates TMDb configuration settings")
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest);

        group.MapGet("media-detection", 
                (IOptionsSnapshot<MediaDetectionOptions> mediaDetectionOptions) => 
                    ConfigController.GetMediaDetectionConfig(mediaDetectionOptions))
            .WithName("GetMediaDetectionConfig")
            .WithDescription("Gets media detection configuration settings")
            .Produces<MediaDetectionOptions>(StatusCodes.Status200OK);

        group.MapPut("media-detection", async Task<IResult> ([FromBody] MediaDetectionOptions config, YamlConfigurationService configService) =>
            {
                if (config == null) return Results.BadRequest("Configuration cannot be null");
                if (config.CacheDuration <= 0) 
                    return Results.BadRequest("Cache duration must be greater than zero");
                
                return await ConfigController.SetMediaDetectionConfig(configService, config);
            })
            .WithName("SetMediaDetectionConfig")
            .WithDescription("Updates media detection configuration settings")
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest);
    }
}
