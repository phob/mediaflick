using Microsoft.AspNetCore.Mvc;
using PlexLocalScan.Shared.Interfaces;
using PlexLocalScan.Shared.Options;
using Microsoft.Extensions.Options;

namespace PlexLocalScan.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SymlinkController : ControllerBase
{
    private readonly ICleanupHandler _cleanupHandler;
    private readonly PlexOptions _plexOptions;
    private readonly ILogger<SymlinkController> _logger;

    public SymlinkController(
        ICleanupHandler cleanupHandler,
        IOptions<PlexOptions> plexOptions,
        ILogger<SymlinkController> logger)
    {
        _cleanupHandler = cleanupHandler;
        _plexOptions = plexOptions.Value;
        _logger = logger;
    }

    /// <summary>
    /// Cleans up dead symlinks and empty folders in the destination folder
    /// </summary>
    /// <returns>A status message indicating the cleanup result</returns>
    /// <response code="200">Cleanup completed successfully</response>
    /// <response code="500">An error occurred during cleanup</response>
    [HttpPost("cleanup")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> CleanupDeadSymlinks()
    {
        try
        {
            foreach (var mapping in _plexOptions.FolderMappings)
            {
                var destinationFolder = mapping.DestinationFolder;
                _logger.LogInformation("Starting cleanup of dead symlinks in {DestinationFolder}", destinationFolder);
                await _cleanupHandler.CleanupDeadSymlinksAsync(destinationFolder);
            }
            return Ok(new { message = "Cleanup completed successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during symlink cleanup");
            return StatusCode(500, new { error = "An error occurred during cleanup" });
        }
    }
} 