using Microsoft.AspNetCore.Mvc;
using PlexLocalScan.Shared.Interfaces;
using PlexLocalScan.Shared.Options;
using Microsoft.Extensions.Options;
using System.ComponentModel;

namespace PlexLocalScan.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
[ApiExplorerSettings(GroupName = "v1")]
[Description("Manages symlink cleanup")]
#pragma warning disable CA1515 // Consider making public types internal
public sealed class SymlinkController(
#pragma warning restore CA1515 // Consider making public types internal
    ICleanupHandler cleanupHandler,
    IOptions<PlexOptions> plexOptions,
    ILogger<SymlinkController> logger) : ControllerBase
{
    private readonly PlexOptions _plexOptions = plexOptions.Value;

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
            await Task.WhenAll(_plexOptions.FolderMappings
                .Select(async mapping =>
                {
                    logger.LogInformation("Starting cleanup of dead symlinks in {DestinationFolder}", mapping.DestinationFolder);
                    await cleanupHandler.CleanupDeadSymlinksAsync(mapping.DestinationFolder);
                }));
            return Ok(new { message = "Cleanup completed successfully" });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error during symlink cleanup");
            return StatusCode(500, new { error = "An error occurred during cleanup" });
        }
    }
} 