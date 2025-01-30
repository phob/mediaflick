using PlexLocalScan.Api.Config;
using PlexLocalScan.Api.Logging;
using PlexLocalScan.Api.MediaLookup;
using PlexLocalScan.Api.ScannedFiles;
using PlexLocalScan.Api.Symlink;

namespace PlexLocalScan.Api;

/// <summary>
/// Extension methods for endpoint registration
/// </summary>
internal static class EndpointExtensions
{
    /// <summary>
    /// Maps all API endpoints for the application
    /// </summary>
    public static IEndpointRouteBuilder MapApiEndpoints(this IEndpointRouteBuilder app)
    {
        // Media lookup endpoints
        app.MapMediaLookupEndpoints();

        // Scanned files endpoints
        app.MapScannedFilesEndpoints();

        // Configuration endpoints
        app.MapConfigEndpoints();

        // Symlink endpoints
        app.MapSymlinkEndpoints();

        // Logging endpoints
        app.MapLoggingEndpoints();

        return app;
    }
}
