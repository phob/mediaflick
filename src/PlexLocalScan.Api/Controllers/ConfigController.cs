using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using PlexLocalScan.Shared.Options;

namespace PlexLocalScan.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ConfigController(
    IOptions<PlexOptions> plexOptions,
    IOptions<TMDbOptions> tmdbOptions,
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
    public IActionResult GetPlexConfig()
    {
        return Ok(plexOptions.Value);
    }

    [HttpGet("tmdb")]
    public IActionResult GetTMDbConfig()
    {
        return Ok(tmdbOptions.Value);
    }

    [HttpGet("media-detection")]
    public IActionResult GetMediaDetectionConfig()
    {
        return Ok(mediaDetectionOptions.Value);
    }
} 