using Coravel;
using PlexLocalScan.Shared.Services;
using PlexLocalScan.SignalR.Hubs;
using PlexLocalScan.SignalR.Services;
using Scalar.AspNetCore;
using Serilog;

namespace PlexLocalScan.Api.ServiceCollection;

public static class Middleware
{
    public static WebApplication AddMiddleware(this WebApplication app)
    {
        // Configure CORS
        app.UseCors();

        // Configure the HTTP request pipeline
        app.UseExceptionHandler(errorApp =>
            errorApp.Run(async context =>
            {
                context.Response.StatusCode = 500;
                context.Response.ContentType = "application/json";
                var error =
                    context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>();
                if (error != null)
                {
                    var ex = error.Error;
                    Log.Error(ex, "An unhandled exception occurred");
                    await context.Response.WriteAsJsonAsync(
                        new
                        {
                            error = "An internal server error occurred.",
                            details = app.Environment.IsDevelopment() ? ex.Message : null,
                        }
                    );
                }
            })
        );

        // Initialize Coravel scheduler
        app.Services.UseScheduler(scheduler =>
        {
            scheduler
                .Schedule<FilePollerService>()
                .EveryMinute()
                .RunOnceAtStart()
                .PreventOverlapping(nameof(FilePollerService));

            scheduler
                .Schedule<HeartbeatService>()
                .EveryThirtySeconds()
                .PreventOverlapping(nameof(HeartbeatService));
            scheduler
                .Schedule<ZurgService>()
                .EveryThirtySeconds()
                .PreventOverlapping(nameof(ZurgService));
        });

        // Add middleware in the correct order
        app.UseRouting();

        // Map endpoints
        app.MapControllers();
        app.MapHub<ContextHub>(ContextHub.Route);
        app.MapApiEndpoints();

        app.MapOpenApi();
        if (app.Environment.IsDevelopment())
        {
            app.MapScalarApiReference(options => options.Theme = ScalarTheme.Mars);
            app.MapGet("/", () => Results.Redirect("/scalar/v1"));
        } else {
            app.MapGet("/", () => Results.Ok("PlexLocalScan API is running"));
        }

        return app;
    }
}
