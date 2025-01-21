using PlexLocalScan.Api.Config;
using Serilog;
using Serilog.Events;

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

        // Configure Serilog
        builder.Host.UseSerilog((context, services, configuration) => configuration
            .ReadFrom.Configuration(context.Configuration)
            .ReadFrom.Services(services)
            .Enrich.FromLogContext()
            .Enrich.WithMachineName()
            .Enrich.WithThreadId()
            .WriteTo.Console()
            .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
            .MinimumLevel.Override("System", LogEventLevel.Warning));

        return builder;
    }
} 