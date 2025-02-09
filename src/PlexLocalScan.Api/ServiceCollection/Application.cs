using System.Text.Json.Serialization;

using Coravel;

using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Http.Resilience;
using Microsoft.Extensions.Options;

using PlexLocalScan.Abstractions;
using PlexLocalScan.Api.Config;
using PlexLocalScan.Data.Data;
using PlexLocalScan.Shared.Configuration.Options;
using PlexLocalScan.Shared.DbContext.Interfaces;
using PlexLocalScan.Shared.DbContext.Services;
using PlexLocalScan.Shared.MediaDetection.Interfaces;
using PlexLocalScan.Shared.MediaDetection.Services;
using PlexLocalScan.Shared.Plex.Interfaces;
using PlexLocalScan.Shared.Plex.Services;
using PlexLocalScan.Shared.Services;
using PlexLocalScan.Shared.Symlinks.Interfaces;
using PlexLocalScan.Shared.Symlinks.Services;
using PlexLocalScan.Shared.TmDbMediaSearch.Interfaces;
using PlexLocalScan.Shared.TmDbMediaSearch.Services;
using PlexLocalScan.SignalR.Services;

using Polly;

namespace PlexLocalScan.Api.ServiceCollection;

public static class Application
{
    public static void AddApplication(
        this IServiceCollection services,
        IConfiguration configuration
    )
    {
        // Add controllers with JSON options
        services
            .AddControllers()
            .AddJsonOptions(options =>
            {
                options.JsonSerializerOptions.WriteIndented = false;
                options.JsonSerializerOptions.DefaultIgnoreCondition =
                    JsonIgnoreCondition.WhenWritingNull;
                options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
            });

        services.AddEndpointsApiExplorer();
        services.AddOpenApi();
        services.ConfigureHttpJsonOptions(options =>
        {
            options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
        });
        services.Configure<Microsoft.AspNetCore.Mvc.JsonOptions>(options =>
        {
            options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        });

        // Configure core services
        services
            .AddOptions()
            .Configure<PlexOptions>(configuration.GetSection("Plex"))
            .Configure<TmDbOptions>(configuration.GetSection("TMDb"))
            .Configure<MediaDetectionOptions>(configuration.GetSection("MediaDetection"))
            .Configure<FolderMappingOptions>(configuration.GetSection("FolderMapping"))
            .Configure<ZurgOptions>(configuration.GetSection("Zurg"));

        services.AddScheduler();

        // Add singleton services
        services.AddSingleton(
            new YamlConfigurationService(
                configuration,
                Path.Combine(AppContext.BaseDirectory, "config", "config.yml")
            )
        );

        // Configure HttpClient for Plex



        // Add scoped services
        services
            .AddScoped<INotificationService, NotificationService>()
            .AddScoped<ISymlinkHandler, SymlinkHandler>()
            .AddScoped<ITmDbClientWrapper>(sp =>
            {
                var tmdbOptions = sp.GetRequiredService<IOptionsSnapshot<TmDbOptions>>();
                return new TmDbClientWrapper(tmdbOptions.Value.ApiKey);
            })
            .AddScoped<IMovieDetectionService, MovieDetectionService>()
            .AddScoped<ITvShowDetectionService, TvShowDetectionService>()
            .AddScoped<IMediaDetectionService, MediaDetectionService>()
            .AddScoped<IMediaSearchService, MediaSearchService>()
            .AddScoped<ICleanupHandler, CleanupHandler>()
            .AddScoped<ISymlinkRecreationService, SymlinkRecreationService>()
            .AddScoped<IContextService, ContextService>()
            .AddScoped<IFileProcessing, FileProcessing>()
            //.AddScoped<IPlexHandler, PlexHandler>()
            .AddScoped<FilePollerService>()
            .AddScoped<ZurgService>()
            .AddScoped<HeartbeatService>();

        // Add database context
        services.AddDbContext<PlexScanContext>(
            (_, options) =>
            {
                var connectionString =
                    $"Data Source={Path.Combine(AppContext.BaseDirectory, "config", "plexscan.db")}";
                options.UseSqlite(connectionString);
            }
        );
        // Add Coravel services
        services.AddQueue();

        services
            .AddHttpClient<IPlexHandler, PlexHandler>("Plex", (serviceProvider, client) =>
            {
                var options = serviceProvider.GetRequiredService<IOptionsMonitor<PlexOptions>>().CurrentValue;
                client.BaseAddress = new Uri(options.ApiEndpoint);
                client.DefaultRequestHeaders.ConnectionClose = true;
            })
            .AddStandardResilienceHandler();


        services.AddHttpClient().AddMemoryCache();
    }
}
