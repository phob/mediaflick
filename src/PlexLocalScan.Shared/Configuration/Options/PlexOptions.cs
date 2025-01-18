using System.Collections.ObjectModel;

namespace PlexLocalScan.Shared.Configuration.Options;

public class PlexOptions
{
    public string Host { get; init; } = string.Empty;
    public int Port { get; init; }
    public string PlexToken { get; init; } = string.Empty;
    public Collection<FolderMappingOptions> FolderMappings { get; init; } = [];
    public int PollingInterval { get; init; } = 30;
    public int ProcessNewFolderDelay { get; init; }
    public string ApiEndpoint => $"http://{Host}:{Port}";
}
