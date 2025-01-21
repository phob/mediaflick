using Microsoft.EntityFrameworkCore;
using PlexLocalScan.Api.ServiceCollection;
using PlexLocalScan.Data.Data;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// Add configuration
builder.AddConfiguration();

// Add services
builder.Services.AddCorsPolicy();
builder.Services.AddApplication(builder.Configuration);

var app = builder.Build();

// Apply migrations on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<PlexScanContext>();
    await db.Database.MigrateAsync();
}

// Configure middleware and endpoints
app.AddMiddleware();

try
{
    Log.Information("Starting PlexLocalScan API");
    await app.RunAsync();
}
catch (Exception ex)
{
    Log.Fatal(ex, "API terminated unexpectedly");
}
finally
{
    await Log.CloseAndFlushAsync();
}
