using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Serilog;
using PlexLocalscan.Options;
using PlexLocalscan.Services;
using Microsoft.Extensions.Http;

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
                config.SetBasePath(Directory.GetCurrentDirectory())
                      .AddJsonFile("appsettings.json", optional: false)
                      .AddJsonFile($"appsettings.{hostContext.HostingEnvironment.EnvironmentName}.json", optional: true)
                      .AddEnvironmentVariables()
                      .AddCommandLine(args);
            })
            .UseSerilog((hostContext, loggerConfig) =>
            {
                var logOptions = hostContext.Configuration.GetSection("Logging").Get<LogOptions>();
                
                loggerConfig
                    .ReadFrom.Configuration(hostContext.Configuration)
                    .WriteTo.File(
                        logOptions?.LogLocation ?? "logs/plexlocalscan.log",
                        rollingInterval: RollingInterval.Day,
                        retainedFileCountLimit: logOptions?.Rotation ?? 7)
                    .Enrich.FromLogContext();
            })
            .ConfigureServices((hostContext, services) =>
            {
                services.Configure<PlexOptions>(
                    hostContext.Configuration.GetSection("Plex"));
                services.Configure<LogOptions>(
                    hostContext.Configuration.GetSection("Logging"));
                
                services.AddHostedService<FileWatcherService>();
                services.AddHttpClient();
                services.AddScoped<IPlexHandler, PlexHandler>();
            });
}
