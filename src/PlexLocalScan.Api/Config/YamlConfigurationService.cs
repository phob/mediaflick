namespace PlexLocalScan.Api.Config;

internal sealed class YamlConfigurationService(IConfiguration configuration, string filePath)
{
    private readonly IConfigurationRoot _configurationRoot = (IConfigurationRoot)configuration;

    public async Task UpdateConfigAsync<T>(string sectionName, T updatedConfig)
    {
        string yaml = File.Exists(filePath) ? await File.ReadAllTextAsync(filePath) : string.Empty;
        var deserializer = new YamlDotNet.Serialization.Deserializer();
        YamlDotNet.Serialization.ISerializer serializer = new YamlDotNet.Serialization.SerializerBuilder().Build();
        Dictionary<string, object> config = deserializer.Deserialize<Dictionary<string, object>>(yaml) ?? [];

        config[sectionName] = updatedConfig ?? throw new ArgumentNullException(nameof(updatedConfig));
        string updatedYaml = serializer.Serialize(config);

        await File.WriteAllTextAsync(filePath, updatedYaml);
        _configurationRoot.Reload();
    }
}
