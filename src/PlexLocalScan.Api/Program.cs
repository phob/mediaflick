using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PlexLocalScan.Abstractions;
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
using PlexLocalScan.Api.Endpoints;

var builder = WebApplication.CreateBuilder(args);

// Configure CORS
builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy
            .WithOrigins("http://localhost:3000")
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials()));

// Configure YAML configuration
var configPath = Path.Combine(AppContext.BaseDirectory, "config", "config.yml");
Directory.CreateDirectory(Path.GetDirectoryName(configPath)!);
Console.WriteLine("configPath: " + configPath);
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
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
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
    .AddScoped<IMediaSearchService, MediaSearchService>()
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
    await db.Database.MigrateAsync();
}

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

// Add middleware in the correct order
app.UseHttpsRedirection();
app.UseRouting();
app.UseCors();

// Map endpoints
app.MapControllers();
app.MapHub<ContextHub>(ContextHub.Route);

// Register all API endpoints
app.MapApiEndpoints();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.MapScalarApiReference(options => options.Theme = ScalarTheme.Mars);
    app.MapGet("/", () => Results.Redirect("/scalar/v1"));
}

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
