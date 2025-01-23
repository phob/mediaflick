using PlexLocalScan.Api.Config;
using PlexLocalScan.Api.Routing;
using Serilog;
using Serilog.Events;
using Serilog.Formatting.Json;

namespace PlexLocalScan.Api.ServiceCollection;

public static class Configuration
{
    public static WebApplicationBuilder AddConfiguration(this WebApplicationBuilder builder)
    {
        // Configure YAML configuration
        var configPath = Path.Combine(AppContext.BaseDirectory, "config", "config.yml");
        Directory.CreateDirectory(Path.GetDirectoryName(configPath)!);
        Console.WriteLine("configPath: " + configPath);
        var configDir = Path.GetDirectoryName(configPath) 
            ?? throw new InvalidOperationException("Config directory path cannot be null");

        ConfigurationHelper.EnsureDefaultConfigAsync(configPath).GetAwaiter().GetResult();

        builder.Configuration
            .SetBasePath(configDir)
            .AddYamlFile(Path.GetFileName(configPath), false, reloadOnChange: true)
            .AddEnvironmentVariables()
            .AddCommandLine(args: []);

        // Ensure logs directory exists
        var logsPath = Path.Combine(AppContext.BaseDirectory, "logs");
        Directory.CreateDirectory(logsPath);

        // Configure Serilog
        builder.Host.UseSerilog((context, services, configuration) => configuration
            .ReadFrom.Configuration(context.Configuration)
            .ReadFrom.Services(services)
            .Enrich.FromLogContext()
            .Enrich.WithMachineName()
            .Enrich.WithThreadId()
            .MinimumLevel.Debug()
            .WriteTo.File(new JsonFormatter(renderMessage: true),
                Path.Combine(logsPath, "log.json"),
                rollingInterval: RollingInterval.Day,
                retainedFileCountLimit: 7,
                fileSizeLimitBytes: 10 * 1024 * 1024) // 10MB
            .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
            .MinimumLevel.Override("System", LogEventLevel.Warning));

        return builder;
    }
} 