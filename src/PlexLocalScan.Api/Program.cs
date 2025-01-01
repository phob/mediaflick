using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PlexLocalScan.Abstractions;
using PlexLocalScan.Core.Helper;
using PlexLocalScan.Data.Data;
using PlexLocalScan.FileTracking.Services;
using PlexLocalScan.Shared.Options;
using PlexLocalScan.Shared.Services;
using PlexLocalScan.Shared.Interfaces;
using PlexLocalScan.SignalR.Hubs;
using PlexLocalScan.SignalR.Services;
using Scalar.AspNetCore;
using Serilog;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// Configure CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy
            .WithOrigins("http://localhost:3000")
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();
    });
});

// Configure YAML configuration
var configPath = Path.Combine(AppContext.BaseDirectory, "config", "config.yml");
Directory.CreateDirectory(Path.GetDirectoryName(configPath)!);

var configDir = Path.GetDirectoryName(configPath) 
    ?? throw new InvalidOperationException("Config directory path cannot be null");

builder.Configuration
    .SetBasePath(configDir)
    .AddYamlFile(Path.GetFileName(configPath), false)
    .AddEnvironmentVariables()
    .AddCommandLine(args);

// Configure Serilog
builder.Host.UseSerilog((context, services, configuration) => configuration
    .ReadFrom.Configuration(context.Configuration)
    .ReadFrom.Services(services)
    .Enrich.FromLogContext()
    .Enrich.WithMachineName()
    .Enrich.WithThreadId());

var services = builder.Services;

// Add SignalR
services.AddSignalR();

// Add services to the container
services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.WriteIndented = false;
        options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
    });
services.AddEndpointsApiExplorer();
services.AddOpenApi();

// Add HeartbeatService
services.AddHostedService<HeartbeatService>();

// Reuse the same services from Console project
services.Configure<PlexOptions>(builder.Configuration.GetSection("Plex"))
    .Configure<TmDbOptions>(builder.Configuration.GetSection("TMDb"))
    .Configure<MediaDetectionOptions>(builder.Configuration.GetSection("MediaDetection"))
    .Configure<DatabaseOptions>(builder.Configuration.GetSection("Database"))
    .Configure<FolderMappingOptions>(builder.Configuration.GetSection("FolderMapping"))
    .AddSingleton<IPlexHandler, PlexHandler>()
    .AddScoped<INotificationService, NotificationService>()
    .AddScoped<ISymlinkHandler, SymlinkHandler>()
    .AddScoped<ITmDbClientWrapper>(sp =>
    {
        var tmdbOptions = sp.GetRequiredService<IOptions<TmDbOptions>>();
        return new TMDbClientWrapper(tmdbOptions.Value.ApiKey);
    })
    .AddScoped<IMovieDetectionService, MovieDetectionService>()
    .AddScoped<ITvShowDetectionService, TvShowDetectionService>()
    .AddScoped<IMediaDetectionService, MediaDetectionService>()
    .AddScoped<IMediaLookupService, MediaSearchService>()
    .AddScoped<IFileSystemService, FileSystemService>()
    .AddScoped<ICleanupHandler, CleanupHandler>()
    .AddScoped<ISymlinkRecreationService, SymlinkRecreationService>()
    .AddScoped<IContextService, ContextService>()
    
    .AddHostedService<FilePollerService>()
    .AddDbContext<PlexScanContext>((_, options) =>
    {
        var connectionString = $"Data Source={Path.Combine(AppContext.BaseDirectory, "config", "plexscan.db")}";
        options.UseSqlite(connectionString);
    })
    .AddHttpClient()
    .AddMemoryCache();

var app = builder.Build();

// Apply migrations on startup
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<PlexScanContext>();
    db.Database.Migrate();
}

// Add exception handling middleware
app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
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
    });
});
// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference(options =>
    {
        options.Theme = ScalarTheme.Mars;
    });
}

app.UseRouting();

// Add CORS middleware
app.UseCors();

//app.UseHttpsRedirection();
//app.UseAuthorization();

// Map SignalR hub
app.MapHub<ContextHub>(ContextHub.Route);

if (app.Environment.IsDevelopment())
{
    // Replace the root path handler with a redirect
    app.MapGet("/", () => Results.Redirect("/scalar/v1"));
}

app.MapControllers();

try
{
    Log.Information("Starting PlexLocalScan API");
    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "API terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}
