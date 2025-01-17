using Microsoft.Extensions.Options;
using PlexLocalScan.Api.Controllers;
using PlexLocalScan.Shared.Interfaces;
using PlexLocalScan.Shared.Options;

namespace PlexLocalScan.Api.Routing;

internal static class SymlinkRouting
{
    private const string SymlinkBaseRoute = "api/symlink";

    public static void MapSymlinkEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup(SymlinkBaseRoute)
            .WithTags("Symlinks")
            .WithOpenApi()
            .WithDescription("Manages symlink cleanup");

        group.MapPost("cleanup", 
                async (ICleanupHandler cleanupHandler, IOptionsSnapshot<PlexOptions> plexOptions, ILogger<Program> logger) => 
                    await SymlinkController.CleanupDeadSymlinks(cleanupHandler, plexOptions, logger))
            .WithName("CleanupDeadSymlinks")
            .WithDescription("Cleans up dead symlinks and empty folders in the destination folder")
            .Produces(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status500InternalServerError);
    }
}
