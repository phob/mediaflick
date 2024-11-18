using Microsoft.OpenApi.Models;
using PlexLocalScan.Data.Data;
using PlexLocalScan.Shared.Options;
using PlexLocalScan.Shared.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PlexLocalScan.Shared.Interfaces;

var builder = WebApplication.CreateBuilder(args);
var services = builder.Services;

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

// Add services to the container
services.AddControllers();
services.AddEndpointsApiExplorer();
services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { 
        Title = "PlexLocalScan API", 
        Version = "v1",
        Description = "API for managing Plex local scanning operations"
    });
});

        // Reuse the same services from Console project
        services.Configure<PlexOptions>(builder.Configuration.GetSection("Plex"))
                .Configure<TMDbOptions>(builder.Configuration.GetSection("TMDb"))
                .Configure<MediaDetectionOptions>(builder.Configuration.GetSection("MediaDetection"))
                .AddSingleton<IPlexHandler, PlexHandler>()
                .AddScoped<ISymlinkHandler, SymlinkHandler>()
                .AddScoped<ITMDbClientWrapper>(sp =>
                {
                    var tmdbOptions = sp.GetRequiredService<IOptions<TMDbOptions>>();
                    return new TMDbClientWrapper(tmdbOptions.Value.ApiKey);
                })
                .AddScoped<IMovieDetectionService, MovieDetectionService>()
                .AddScoped<ITvShowDetectionService, TvShowDetectionService>()
                .AddScoped<IMediaDetectionService, MediaDetectionService>()
                .AddScoped<IDateTimeProvider, DateTimeProvider>()
                .AddScoped<IFileSystemService, FileSystemService>()
                .AddScoped<IFileTrackingService, FileTrackingService>()
                .AddDbContext<PlexScanContext>((serviceProvider, options) =>
                {
                    var databaseOptions = "Data Source=" + Path.Combine(configDir, "plexscan.db");
                    options.UseSqlite(databaseOptions);
                })
                .AddHttpClient()
                .AddMemoryCache();
var app = builder.Build();

// Configure the HTTP request pipeline
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "PlexLocalScan API v1");
    c.RoutePrefix = "swagger";
});

app.UseRouting();
//app.UseHttpsRedirection();
//app.UseAuthorization();

app.MapControllers();

app.Run();
