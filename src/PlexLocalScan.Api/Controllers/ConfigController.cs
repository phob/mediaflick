using System.ComponentModel;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using PlexLocalScan.Shared.Options;

namespace PlexLocalScan.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
[ApiExplorerSettings(GroupName = "v1")]
[Description("Manages configuration settings for the application")]
#pragma warning disable CA1515 // Consider making public types internal
public sealed class ConfigController(
#pragma warning restore CA1515 // Consider making public types internal
    IOptions<PlexOptions> plexOptions,
    IOptions<TmDbOptions> tmdbOptions,
    IOptions<MediaDetectionOptions> mediaDetectionOptions) : ControllerBase
{
    [HttpGet]
    public IActionResult GetAllConfigurations()
    {
        var config = new
        {
            Plex = plexOptions.Value,
            TMDb = tmdbOptions.Value,
            MediaDetection = mediaDetectionOptions.Value
        };

        return Ok(config);
    }

    [HttpGet("plex")]
    public IActionResult GetPlexConfig() => Ok(plexOptions.Value);

    [HttpGet("tmdb")]
    public IActionResult GetTMDbConfig() => Ok(tmdbOptions.Value);

    [HttpGet("media-detection")]
    public IActionResult GetMediaDetectionConfig() => Ok(mediaDetectionOptions.Value);
} 