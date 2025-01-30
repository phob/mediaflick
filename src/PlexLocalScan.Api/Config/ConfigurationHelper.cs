using YamlDotNet.Serialization;

namespace PlexLocalScan.Api.Config;

internal static class ConfigurationHelper
{
    public static async Task EnsureDefaultConfigAsync(string configPath)
    {
        var configDir =
            Path.GetDirectoryName(configPath)
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
                        new
                        {
                            SourceFolder = "/mnt/zurg/movies",
                            DestinationFolder = "/mnt/organized/movies",
                            MediaType = "Movies",
                        },
                        new
                        {
                            SourceFolder = "/mnt/zurg/tvseries",
                            DestinationFolder = "/mnt/organized/tvseries",
                            MediaType = "TvShows",
                        },
                    },
                },
                TMDb = new { ApiKey = "your-tmdb-api-key" },
                MediaDetection = new { CacheDuration = 3600 },
            };

            var serializer = new SerializerBuilder().Build();
            var yaml = serializer.Serialize(defaultConfig);
            await File.WriteAllTextAsync(configPath, yaml);

            Console.WriteLine($"Default configuration created at: {configPath}");
        }
    }
}
