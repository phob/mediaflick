using Microsoft.EntityFrameworkCore;
using PlexLocalScan.Api.ServiceCollection;
using PlexLocalScan.Data.Data;
using Serilog;
using PlexLocalScan.Shared.Services;

var builder = WebApplication.CreateBuilder(args);

// Configuration and logging setup
builder.AddConfiguration();
builder.Services.AddApplication(builder.Configuration);
builder.Services.AddSignalRService();

var app = builder.Build();

// Database migrations
await using (var scope = app.Services.CreateAsyncScope())
{
    var db = scope.ServiceProvider.GetRequiredService<PlexScanContext>();
    await db.Database.MigrateAsync();
}

// Middleware pipeline
app.AddMiddleware();

try
{
    Log.Information("Starting PlexLocalScan API");
    await app.RunAsync();
}
catch (Exception ex) when (ex is not HostAbortedException)
{
    Log.Fatal(ex, "API terminated unexpectedly");
}
finally
{
    await Log.CloseAndFlushAsync();
}