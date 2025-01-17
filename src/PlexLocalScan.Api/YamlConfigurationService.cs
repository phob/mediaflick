namespace PlexLocalScan.Api;

internal sealed class YamlConfigurationService(IConfiguration configuration, string filePath)
{
    private readonly IConfigurationRoot _configurationRoot = (IConfigurationRoot)configuration;

    public async Task UpdateConfigAsync<T>(string sectionName, T updatedConfig)
    {
        var yaml = File.Exists(filePath) ? await File.ReadAllTextAsync(filePath) : string.Empty;
        var deserializer = new YamlDotNet.Serialization.Deserializer();
        var serializer = new YamlDotNet.Serialization.SerializerBuilder().Build();
        var config = deserializer.Deserialize<Dictionary<string, object>>(yaml) ?? [];

        config[sectionName] = updatedConfig ?? throw new ArgumentNullException(nameof(updatedConfig));
        var updatedYaml = serializer.Serialize(config);

        await File.WriteAllTextAsync(filePath, updatedYaml);
        _configurationRoot.Reload();
    }
}
