using Microsoft.AspNetCore.Mvc;
using Serilog.Events;

namespace PlexLocalScan.Api.Logging;

internal static class LoggingRouting
{
    private const string LoggingBaseRoute = "api/logs";

    public static void MapLoggingEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup(LoggingBaseRoute)
            .WithTags("Logging")
            .WithOpenApi()
            .WithDescription("Provides access to application logs");

        group
            .MapGet(
                "/",
                async (
                    [FromServices] LoggingController controller,
                    [FromQuery] LogEventLevel? minLevel,
                    [FromQuery] string? searchTerm,
                    [FromQuery] DateTime? from,
                    [FromQuery] DateTime? to,
                    [FromQuery] int limit = 100
                ) =>
                {
                    return await controller.GetLogs(minLevel, searchTerm, from, to, limit);
                }
            )
            .WithName("GetLogs")
            .WithDescription("Retrieves application logs with optional filtering")
            .Produces<object>(StatusCodes.Status200OK)
            .Produces(StatusCodes.Status500InternalServerError);
    }
}
