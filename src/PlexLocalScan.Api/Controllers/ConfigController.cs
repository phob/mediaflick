using Microsoft.Extensions.Options;
using PlexLocalScan.Api.Config;
using PlexLocalScan.Shared.Configuration.Options;

namespace PlexLocalScan.Api.Controllers;

/// <summary>
/// Endpoint implementations for configuration functionality
/// </summary>
internal static class ConfigController
{
    internal static IResult GetAllConfigurations(
        IOptionsSnapshot<PlexOptions> plexOptions,
        IOptionsSnapshot<TmDbOptions> tmdbOptions,
        IOptionsSnapshot<MediaDetectionOptions> mediaDetectionOptions)
    {
        var config = new
        {
            Plex = plexOptions.Value,
            TMDb = tmdbOptions.Value,
            MediaDetection = mediaDetectionOptions.Value
        };

        return Results.Ok(config);
    }

    internal static IResult GetPlexConfig(IOptionsSnapshot<PlexOptions> plexOptions)
    {
        return Results.Ok(plexOptions.Value);
    }

    internal static IResult GetTmDbConfig(IOptionsSnapshot<TmDbOptions> tmdbOptions)
    {
        return Results.Ok(tmdbOptions.Value);
    }

    internal static IResult GetMediaDetectionConfig(IOptionsSnapshot<MediaDetectionOptions> mediaDetectionOptions)
    {
        return Results.Ok(mediaDetectionOptions.Value);
    }

    internal static async Task<IResult> SetPlexConfig(YamlConfigurationService configService, PlexOptions value)
    {
        await configService.UpdateConfigAsync("Plex", value);
        return Results.Ok();
    }

    internal static async Task<IResult> SetTmDbConfig(YamlConfigurationService configService, TmDbOptions value)
    {
        if (string.IsNullOrEmpty(value.ApiKey))
            return Results.BadRequest("TMDb API key is required");

        await configService.UpdateConfigAsync("TMDb", value);
        return Results.Ok();
    }

    internal static async Task<IResult> SetMediaDetectionConfig(YamlConfigurationService configService, MediaDetectionOptions value)
    {
        if (value.CacheDuration <= 0)
            return Results.BadRequest("Cache duration must be greater than zero");

        await configService.UpdateConfigAsync("MediaDetection", value);
        return Results.Ok();
    }
} 
