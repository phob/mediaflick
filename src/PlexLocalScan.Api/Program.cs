using Microsoft.OpenApi.Models;
using PlexLocalScan.Data.Data;
using PlexLocalScan.Shared.Options;
using PlexLocalScan.Shared.Services;
using Microsoft.EntityFrameworkCore;

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
    .AddMemoryCache()
    .AddSingleton<IPlexHandler, PlexHandler>()
    .AddSingleton<ISymlinkHandler, SymlinkHandler>()
    .AddHostedService<FileWatcherService>()
    .AddHttpClient()
    .AddSingleton<IMediaDetectionService, MediaDetectionService>();

builder.Services.AddDbContext<PlexScanContext>((serviceProvider, options) =>
{
    var databaseOptions = "Data Source=" + Path.Combine(builder.Configuration["ConfigDir"]!, "plexscan.db");
    options.UseSqlite(databaseOptions);
});

builder.Services.AddScoped<IFileTrackingService, FileTrackingService>();

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseAuthorization();
app.MapControllers();

app.Run();
