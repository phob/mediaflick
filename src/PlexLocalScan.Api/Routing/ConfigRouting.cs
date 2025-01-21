﻿using Microsoft.Extensions.Options;
using Microsoft.AspNetCore.Mvc;
using PlexLocalScan.Api.Config;
using PlexLocalScan.Shared.Configuration.Options;

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

        group.MapPut("/", async Task<IResult> (
            [FromBody] CombinedConfig config,
            YamlConfigurationService configService) =>
        {
            var errors = new List<string>();
            
            errors.AddIfNotNull(ValidatePlexConfig(config.Plex));
            if (string.IsNullOrEmpty(config.TMDb?.ApiKey))
                errors.Add("TMDb API key is required");
            if (config.MediaDetection?.CacheDuration <= 0)
                errors.Add("Media detection cache duration must be greater than zero");

            if (errors.Count > 0)
                return Results.BadRequest(errors);

            await Task.WhenAll(
                configService.UpdateConfigAsync("Plex", config.Plex),
                configService.UpdateConfigAsync("TMDb", config.TMDb),
                configService.UpdateConfigAsync("MediaDetection", config.MediaDetection));
            return Results.Ok();
        })
            .WithName("UpdateAllConfigurations")
            .WithDescription("Updates all configuration settings atomically")
            .Produces(StatusCodes.Status200OK)
            .Produces<List<string>>(StatusCodes.Status400BadRequest);
;

        group.MapGet("/", 
                (IOptionsSnapshot<PlexOptions> plexOptions, 
                 IOptionsSnapshot<TmDbOptions> tmdbOptions,
                 IOptionsSnapshot<MediaDetectionOptions> mediaDetectionOptions) => 
                {
                    var config = new
                    {
                        Plex = plexOptions.Value,
                        TMDb = tmdbOptions.Value,
                        MediaDetection = mediaDetectionOptions.Value
                    };
                    return Results.Ok(config);
                })
            .WithName("GetAllConfigurations")
            .WithDescription("Gets all configuration settings")
            .Produces<object>(StatusCodes.Status200OK);

        group.MapGet("plex", 
                (IOptionsSnapshot<PlexOptions> plexOptions) => Results.Ok(plexOptions.Value))
            .WithName("GetPlexConfig")
            .WithDescription("Gets Plex configuration settings")
            .Produces<PlexOptions>(StatusCodes.Status200OK);

        group.MapPut("plex", async Task<IResult> ([FromBody] PlexOptions config, YamlConfigurationService configService) =>
            {
                var validationError = ValidatePlexConfig(config);
            
    if (validationError is not null)
                    return Results.BadRequest(validationError);

                await configService.UpdateConfigAsync("Plex", config);
                return Results.Ok();
           } )
            .WithName("SetPlexConfig")
            .WithDescription("Updates Plex configuration settings")
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest);

        group.MapGet("tmdb", 
                (IOptionsSnapshot<TmDbOptions> tmdbOptions) => Results.Ok(tmdbOptions.Value))
            .WithName("GetTMDbConfig")
            .WithDescription("Gets TMDb configuration settings")
            .Produces<TmDbOptions>(StatusCodes.Status200OK);

        group.MapPut("tmdb", async Task<IResult> ([FromBody] TmDbOptions config, YamlConfigurationService configService) =>
        {
            if (config is null || string.IsNullOrEmpty(config.ApiKey))
                return ValidationError("TMDb API key is required");

            await configService.UpdateConfigAsync("TMDb", config);
            return Results.Ok();
        })
  
            .WithName("SetTMDbConfig")
            .WithDescription("Updates TMDb configuration settings")
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest);

        group.MapGet("media-detection", 
                (IOptionsSnapshot<MediaDetectionOptions> mediaDetectionOptions) => Results.Ok(mediaDetectionOptions.Value))
            .WithName("GetMediaDetectionConfig")
            .WithDescription("Gets media detection configuration settings")
            .Produces<MediaDetectionOptions>(StatusCodes.Status200OK);

        group.MapPut("media-detection", async Task<IResult> ([FromBody] MediaDetectionOptions config, YamlConfigurationService configService) =>
        {
            if (config is null)
                return ValidationError("Configuration cannot be null");

            return config.CacheDuration <= 0 
                ? ValidationError("Cache duration must be greater than zero") 
                : await UpdateConfigAsync(configService, "MediaDetection", config);
        })
            .WithName("SetMediaDetectionConfig")
            .WithDescription("Updates media detection configuration settings")
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status400BadRequest);
    }

    private sealed record CombinedConfig(
        PlexOptions Plex,
        TmDbOptions TMDb,
        MediaDetectionOptions MediaDetection
    );


    private static async Task<IResult> UpdateConfigAsync(YamlConfigurationService service, string section, object config)
    {
        await service.UpdateConfigAsync(section, config);
        return Results.Ok();
    }

    private static IResult ValidationError(string message) => Results.BadRequest(message);

    private static string? ValidatePlexConfig(PlexOptions? config)
    {
        if (config is null) return "Configuration cannot be null";
        if (string.IsNullOrEmpty(config.Host)) return "Host is required";
        if (config.Port <= 0) return "Port must be greater than 0";
        if (config.FolderMappings?.Any() != true) return "At least one folder mapping is required";
        
        var hasInvalidMappings = config.FolderMappings.Any(m => 
            string.IsNullOrEmpty(m.SourceFolder) || 
            string.IsNullOrEmpty(m.DestinationFolder));
            
        return hasInvalidMappings 
            ? "All folder mappings require both source and destination paths" 
            : null;
    }

    private static void AddIfNotNull(this List<string> list, string? value)
    {
        if (value is not null)
            list.Add(value);
    }
}
