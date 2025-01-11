using PlexLocalScan.Api.Controllers;
using PlexLocalScan.Api.Routing;

namespace PlexLocalScan.Api.Endpoints;

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

        return app;
    }
} 
