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
using PlexLocalScan.Api.Loader;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

// Configure CORS
builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy
            .WithOrigins("http://localhost:3000")
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials()));

// Configure YAML configuration
string configPath = Path.Combine(AppContext.BaseDirectory, "config", "config.yml");
Directory.CreateDirectory(Path.GetDirectoryName(configPath)!);
Console.WriteLine("configPath: " + configPath);
string configDir = Path.GetDirectoryName(configPath) 
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

IServiceCollection services = builder.Services;

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
        IOptions<TmDbOptions> tmdbOptions = sp.GetRequiredService<IOptions<TmDbOptions>>();
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
        string connectionString = $"Data Source={Path.Combine(AppContext.BaseDirectory, "config", "plexscan.db")}";
        options.UseSqlite(connectionString);
    })
    .AddHttpClient()
    .AddMemoryCache();

// Configure database settings
services.AddOptions<PlexOptions>()
    .Configure<PlexScanContext>((options, context) =>
    {
        var settingsLoader = new DatabaseSettingsLoader(context);
        PlexDbOptions plexOptions = settingsLoader.LoadPlexOptionsAsync().GetAwaiter().GetResult();
        
        options.Host = plexOptions.Host;
        options.Port = plexOptions.Port;
        options.PlexToken = plexOptions.PlexToken;
        options.PollingInterval = plexOptions.PollingInterval;
        options.ProcessNewFolderDelay = plexOptions.ProcessNewFolderDelay;
        foreach (FolderMappingDbOptions fm in plexOptions.FolderMappings)
        {
            options.FolderMappings.Add(new FolderMappingOptions
            {
                SourceFolder = fm.SourceFolder,
                DestinationFolder = fm.DestinationFolder,
                MediaType = fm.MediaType
            });
        }
    });

services.AddOptions<TmDbOptions>()
    .Configure<PlexScanContext>((options, context) =>
    {
        var settingsLoader = new DatabaseSettingsLoader(context);
        TmDbDbOptions tmdbOptions = settingsLoader.LoadTmDbOptionsAsync().GetAwaiter().GetResult();
        options.ApiKey = tmdbOptions.ApiKey;
    });

services.AddOptions<MediaDetectionOptions>()
    .Configure<PlexScanContext>((options, context) =>
    {
        var settingsLoader = new DatabaseSettingsLoader(context);
        MediaDetectionDbOptions mediaDetectionOptions = settingsLoader.LoadMediaDetectionOptionsAsync().GetAwaiter().GetResult();
        options.CacheDurationSeconds = TimeSpan.FromSeconds(mediaDetectionOptions.CacheDurationSeconds);
    });

WebApplication app = builder.Build();

// Apply migrations on startup
using IServiceScope scope = app.Services.CreateScope();
PlexScanContext dbContext = scope.ServiceProvider.GetRequiredService<PlexScanContext>();
await dbContext.Database.MigrateAsync();

// Configure the HTTP request pipeline
app.UseExceptionHandler(errorApp => errorApp.Run(async context =>
    {
        context.Response.StatusCode = 500;
        context.Response.ContentType = "application/json";
        Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature? error = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>();
        if (error != null)
        {
            Exception ex = error.Error;
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
