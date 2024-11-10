using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Serilog;
using PlexLocalscan.Options;
using PlexLocalscan.Services;
using Microsoft.Extensions.Http;
using TMDbLib.Client;

class Program
{
    public static async Task Main(string[] args)
    {
        var host = CreateHostBuilder(args).Build();
        await host.RunAsync();
    }

    private static IHostBuilder CreateHostBuilder(string[] args) =>
        Host.CreateDefaultBuilder(args)
            .ConfigureAppConfiguration((hostContext, config) =>
            {
                // Default config path for Linux/Docker
                var configPath = "/config/config.yml";

                // If running on Windows or config doesn't exist, try local path
                if (!File.Exists(configPath))
                {
                    configPath = Path.Combine(
                        AppContext.BaseDirectory, 
                        "config", 
                        "config.yml"
                    );
                }

                // Create config directory if it doesn't exist
                Directory.CreateDirectory(Path.GetDirectoryName(configPath)!);

                // If config file doesn't exist, create default
                if (!File.Exists(configPath))
                {
                    CreateDefaultConfig(configPath);
                }

                config.SetBasePath(Path.GetDirectoryName(configPath))
                      .AddYamlFile(Path.GetFileName(configPath), false)
                      .AddEnvironmentVariables()
                      .AddCommandLine(args);
            })
            .UseSerilog((hostContext, loggerConfig) =>
            {
                loggerConfig
                    .ReadFrom.Configuration(hostContext.Configuration)
                    .Enrich.FromLogContext();
            })
            .ConfigureServices((hostContext, services) =>
            {
                services.Configure<PlexOptions>(
                    hostContext.Configuration.GetSection("Plex"));
                
                services.AddHostedService<FileWatcherService>();
                services.AddHttpClient();
                services.AddScoped<IPlexHandler, PlexHandler>();
                services.AddScoped<ISymlinkHandler, SymlinkHandler>();
                services.AddSingleton(new TMDbClient("your_tmdb_api_key"));
                services.AddScoped<IMediaDetectionService, MediaDetectionService>();
            });

    private static void CreateDefaultConfig(string path)
    {
        var defaultConfig = @"
Serilog:
  MinimumLevel:
    Default: Information
    Override:
      Microsoft: Warning
      System: Warning
      PlexLocalscan.Services: Information
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
";
        File.WriteAllText(path, defaultConfig);
    }
}
