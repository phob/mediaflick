using Microsoft.Extensions.Options;
using PlexLocalScan.Shared.Options;

namespace PlexLocalScan.Api.Controllers;

/// <summary>
/// Endpoint implementations for configuration functionality
/// </summary>
internal static class ConfigController
{
    internal static IResult GetAllConfigurations(
        IOptions<PlexOptions> plexOptions,
        IOptions<TmDbOptions> tmdbOptions,
        IOptions<MediaDetectionOptions> mediaDetectionOptions)
    {
        var config = new
        {
            Plex = plexOptions.Value,
            TMDb = tmdbOptions.Value,
            MediaDetection = mediaDetectionOptions.Value
        };

        return Results.Ok(config);
    }

    internal static IResult GetPlexConfig(IOptions<PlexOptions> plexOptions) => 
        Results.Ok(plexOptions.Value);

    internal static IResult GetTMDbConfig(IOptions<TmDbOptions> tmdbOptions) => 
        Results.Ok(tmdbOptions.Value);

    internal static IResult GetMediaDetectionConfig(IOptions<MediaDetectionOptions> mediaDetectionOptions) => 
        Results.Ok(mediaDetectionOptions.Value);
} 