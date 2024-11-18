using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
using Serilog;
using PlexLocalScan.Shared.Options;
using PlexLocalScan.Shared.Services;
using PlexLocalScan.Data.Data;
using Microsoft.Extensions.Options;
using PlexLocalScan.Shared.Interfaces;
public static class Program
{
    public static async Task<int> Main(string[] args)
    {
        try
        {
            await MainImpl(args);
            return 0;
        }
        catch (Exception ex)
        {
            Log.Fatal(ex, "Application terminated unexpectedly");
            return 1;
        }
        finally
        {
            Log.CloseAndFlush();
        }
    }

    private static async Task MainImpl(string[] args)
    {
        var builder = Host.CreateApplicationBuilder(args);
        
        var configPath = Path.Combine(AppContext.BaseDirectory, "config", "config.yml");

        Directory.CreateDirectory(Path.GetDirectoryName(configPath)!);

        if (!File.Exists(configPath))
        {
            CreateDefaultConfig(configPath);
        }

        var configDir = Path.GetDirectoryName(configPath) 
            ?? throw new InvalidOperationException("Config directory path cannot be null");

        builder.Configuration
            .SetBasePath(configDir)
            .AddYamlFile(Path.GetFileName(configPath), false)
            .AddEnvironmentVariables()
            .AddCommandLine(args);

        Log.Logger = new LoggerConfiguration()
            .ReadFrom.Configuration(builder.Configuration)
            .Enrich.FromLogContext()
            .CreateLogger();

        builder.Services.AddLogging(loggingBuilder =>
        {
            loggingBuilder.ClearProviders();
            loggingBuilder.AddSerilog(Log.Logger, dispose: true);
        });

        var services = builder.Services;
        services.Configure<PlexOptions>(builder.Configuration.GetSection("Plex"))
                .Configure<TMDbOptions>(builder.Configuration.GetSection("TMDb"))
                .Configure<MediaDetectionOptions>(builder.Configuration.GetSection("MediaDetection"))
                .AddSingleton<IPlexHandler, PlexHandler>()
                .AddSingleton<ISymlinkHandler, SymlinkHandler>()
                .AddHostedService<FileWatcherService>()
                .AddSingleton<ITMDbClientWrapper>(sp =>
                {
                    var tmdbOptions = sp.GetRequiredService<IOptions<TMDbOptions>>();
                    return new TMDbClientWrapper(tmdbOptions.Value.ApiKey);
                })
                .AddScoped<IMovieDetectionService, MovieDetectionService>()
                .AddScoped<ITvShowDetectionService, TvShowDetectionService>()
                .AddScoped<IMediaDetectionService, MediaDetectionService>()
                .AddSingleton<IDateTimeProvider, DateTimeProvider>()
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

        using (var scope = app.Services.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<PlexScanContext>();
            context.Database.EnsureCreated();
        }

        await app.RunAsync();
    }

    private static void CreateDefaultConfig(string path)
    {
        var defaultConfig = @"
Serilog:
  MinimumLevel:
    Default: Information
    Override:
      Microsoft: Warning
      System: Warning
      PlexLocalScan: Information
  WriteTo:
    - Name: Console
      Args:
        theme: Serilog.Sinks.SystemConsole.Themes.AnsiConsoleTheme::Code, Serilog.Sinks.Console
        outputTemplate: '[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}'
    - Name: File
      Args:
        path: logs/plexlocalscan.log
        rollingInterval: Day
        outputTemplate: '{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] {Message:lj}{NewLine}{Exception}'
        retainedFileCountLimit: 7

Plex:
  Host: localhost
  Port: 32400
  PlexToken: your_plex_token_here
  FolderMappings:
    - SourceFolder: /downloads/movies
      DestinationFolder: /media/movies
      MediaType: Movies
    - SourceFolder: /downloads/shows
      DestinationFolder: /media/shows
      MediaType: TvShows
  PollingInterval: 30
  FileWatcherPeriod: 10000

TMDb:
  ApiKey: your_tmdb_api_key

Database:
  ConnectionString: ""Data Source=plexscan.db""
";
        File.WriteAllText(path, defaultConfig);
    }
}
