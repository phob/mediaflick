namespace PlexLocalScan.Api.Config;

internal sealed class YamlConfigurationService(IConfiguration configuration, string filePath)
{
    private readonly IConfigurationRoot _configurationRoot = (IConfigurationRoot)configuration;

    public async Task UpdateConfigAsync(object config)
    {
        ArgumentNullException.ThrowIfNull(config);

        var serializer = new YamlDotNet.Serialization.SerializerBuilder().Build();
        string updatedYaml = serializer.Serialize(config);

        await File.WriteAllTextAsync(filePath, updatedYaml);
        _configurationRoot.Reload();
    }
}
