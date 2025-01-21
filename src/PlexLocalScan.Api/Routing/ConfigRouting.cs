﻿using Microsoft.Extensions.Options;
using Microsoft.AspNetCore.Mvc;
using PlexLocalScan.Api.Config;
using PlexLocalScan.Shared.Configuration.Options;
using PlexLocalScan.Core.Tables;

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
                (IOptionsSnapshot<PlexOptions> plexOptions, 
                 IOptionsSnapshot<TmDbOptions> tmdbOptions,
                 IOptionsSnapshot<MediaDetectionOptions> mediaDetectionOptions) => 
                {
                    var config = new CombinedConfig(
                        plexOptions.Value,
                        tmdbOptions.Value,
                        mediaDetectionOptions.Value
                    );
                    return Results.Ok(config);
                })
            .WithName("GetConfiguration")
            .WithDescription("Gets all configuration settings")
            .Produces<CombinedConfig>(StatusCodes.Status200OK);

        group.MapPut("/", async Task<IResult> (
            [FromBody] CombinedConfig config,
            YamlConfigurationService configService) =>
        {
            var errors = ValidateConfig(config);
            if (errors.Count > 0)
                return Results.BadRequest(errors);

            await configService.UpdateConfigAsync(config);
            return Results.Ok();
        })
            .WithName("UpdateConfiguration")
            .WithDescription("Updates all configuration settings")
            .Produces(StatusCodes.Status200OK)
            .Produces<List<string>>(StatusCodes.Status400BadRequest);
    }

    private sealed record CombinedConfig(
        PlexOptions Plex,
        TmDbOptions TmDb,
        MediaDetectionOptions MediaDetection
    );

    private static List<string> ValidateConfig(CombinedConfig config)
    {
        var errors = new List<string>();
        
        // Validate Plex config
        if (config.Plex is null) errors.Add("Plex configuration cannot be null");
        else
        {
            if (string.IsNullOrEmpty(config.Plex.Host)) errors.Add("Plex host is required");
            if (config.Plex.Port <= 0) errors.Add("Plex port must be greater than 0");
            if (config.Plex.FolderMappings.Count == 0) errors.Add("At least one Plex folder mapping is required");
            
            var hasInvalidMappings = config.Plex.FolderMappings.Any(m => 
                string.IsNullOrEmpty(m.SourceFolder) || 
                string.IsNullOrEmpty(m.DestinationFolder));
                
            if (hasInvalidMappings) errors.Add("All Plex folder mappings require both source and destination paths");
        }

        // Validate TMDb config
        if (config.TmDb is null) errors.Add("TMDb configuration cannot be null");
        else if (string.IsNullOrEmpty(config.TmDb.ApiKey)) errors.Add("TMDb API key is required");

        // Validate MediaDetection config
        if (config.MediaDetection is null) errors.Add("Media detection configuration cannot be null");
        else if (config.MediaDetection.CacheDuration <= 0) errors.Add("Media detection cache duration must be greater than zero");

        return errors;
    }
}
