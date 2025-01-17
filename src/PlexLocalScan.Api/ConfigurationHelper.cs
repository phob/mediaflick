using YamlDotNet.Serialization;

namespace PlexLocalScan.Api;

internal static class ConfigurationHelper
{
    public static async Task EnsureDefaultConfigAsync(string configPath)
    {
        var configDir = Path.GetDirectoryName(configPath)
                        ?? throw new InvalidOperationException("Config directory path cannot be null");

        // Ensure the config directory exists
        Directory.CreateDirectory(configDir);

        // Check if the config file exists
        if (!File.Exists(configPath))
        {
            var defaultConfig = new
            {
                Plex = new
                {
                    Host = "localhost",
                    Port = 32400,
                    PlexToken = "",
                    PollingInterval = 60,
                    ProcessNewFolderDelay = 30,
                    FolderMappings = new[]
                    {
                        new { SourceFolder = "/path/to/source", DestinationFolder = "/path/to/destination", MediaType = "Movies" }
                    }
                },
                TMDb = new
                {
                    ApiKey = "your-tmdb-api-key"
                },
                MediaDetection = new
                {
                    CacheDurationSeconds = 3600
                }
            };

            var serializer = new SerializerBuilder().Build();
            var yaml = serializer.Serialize(defaultConfig);
            await File.WriteAllTextAsync(configPath, yaml);

            Console.WriteLine($"Default configuration created at: {configPath}");
        }
    }

}
