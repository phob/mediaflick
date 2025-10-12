using Microsoft.Extensions.Options;
using PlexLocalScan.Shared.Configuration.Options;
using PlexLocalScan.Shared.Symlinks.Interfaces;

namespace PlexLocalScan.Api.Symlink;

/// <summary>
/// Endpoint implementations for symlink functionality
/// </summary>
internal static class SymlinkController
{
    internal static async Task<IResult> CleanupDeadSymlinks(
        ICleanupHandler cleanupHandler,
        IOptionsSnapshot<PlexOptions> plexOptions,
        ILogger<Program> logger
    )
    {
        try
        {
            await Task.WhenAll(
                plexOptions.Value.FolderMappings.Select(async mapping =>
                {
                    logger.LogInformation(
                        "Starting cleanup of dead symlinks in {DestinationFolder}",
                        mapping.DestinationFolder
                    );
                    await cleanupHandler.CleanupDeadSymlinksAsync(mapping.DestinationFolder);
                })
            );
            return Results.Ok(new { message = "Cleanup completed successfully" });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error during symlink cleanup");
            return Results.Problem(
                detail: "An error occurred during cleanup",
                statusCode: StatusCodes.Status500InternalServerError
            );
        }
    }
}
