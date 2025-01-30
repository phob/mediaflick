using Coravel;

using PlexLocalScan.Api.Endpoints;
using PlexLocalScan.Shared.Services;
using PlexLocalScan.SignalR.Hubs;
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
        app.UseExceptionHandler(errorApp => errorApp.Run(async context =>
        {
            context.Response.StatusCode = 500;
            context.Response.ContentType = "application/json";
            var error = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>();
            if (error != null)
            {
                var ex = error.Error;
                Log.Error(ex, "An unhandled exception occurred");
                await context.Response.WriteAsJsonAsync(new
                {
                    error = "An internal server error occurred.",
                    details = app.Environment.IsDevelopment() ? ex.Message : null
                });
            }
        }));

        // Initialize Coravel scheduler
        app.Services.UseScheduler(scheduler =>
        {
            scheduler.Schedule<FilePollerService>().EveryMinute();
        });

        // Add middleware in the correct order
        app.UseRouting();

        // Map endpoints
        app.MapControllers();
        app.MapHub<ContextHub>(ContextHub.Route);
        app.MapApiEndpoints();

        app.MapOpenApi();
        app.MapScalarApiReference(options => options.Theme = ScalarTheme.Mars);
        app.MapGet("/", () => Results.Redirect("/scalar/v1"));

        return app;
    }
} 