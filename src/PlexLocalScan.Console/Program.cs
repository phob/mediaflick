using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Microsoft.EntityFrameworkCore;
using Serilog;
using TMDbLib.Client;
using PlexLocalScan.Console.Options;
using PlexLocalScan.Console.Services;
using PlexLocalScan.Console.Data;

class Program
{
    public static Task Main(string[] args)
    {
        var builder = Host.CreateApplicationBuilder(args);
        
        var configPath = "/config/config.yml";

        if (!File.Exists(configPath))
        {
            configPath = Path.Combine(AppContext.BaseDirectory, "config", "config.yml");
        }

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

        builder.Services.AddSerilog((hostContext, loggerConfig) =>
        {
            loggerConfig
                .ReadFrom.Configuration(builder.Configuration)
                .Enrich.FromLogContext();
        });

        var services = builder.Services;
        services.Configure<PlexOptions>(builder.Configuration.GetSection("Plex"))
                .AddMemoryCache()
                .AddHostedService<FileWatcherService>()
                .AddHttpClient()
                .AddScoped<IPlexHandler, PlexHandler>()
                .AddScoped<ISymlinkHandler, SymlinkHandler>()
                .AddSingleton(new TMDbClient("your_tmdb_api_key"))
                .AddScoped<IMediaDetectionService, MediaDetectionService>();

        services.Configure<DatabaseOptions>(builder.Configuration.GetSection(DatabaseOptions.Database));

        services.AddDbContext<PlexScanContext>((serviceProvider, options) =>
        {
            var databaseOptions = serviceProvider.GetRequiredService<IOptions<DatabaseOptions>>().Value;
            options.UseSqlite(databaseOptions.ConnectionString);
        });

        services.AddScoped<IFileTrackingService, FileTrackingService>();

        var app = builder.Build();
        return app.RunAsync();
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
      PlexLocalScan.Services: Information
  WriteTo:
    - Name: Console
      Args:
        outputTemplate: '{Timestamp:HH:mm:ss} [{Level:u3}] {Message:lj}{NewLine}{Exception}'
    - Name: File
      Args:
        path: /config/logs/plexlocalscan.log
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

Database:
  ConnectionString: ""Data Source=plexscan.db""
";
        File.WriteAllText(path, defaultConfig);
    }
}
