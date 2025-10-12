using System.Collections.ObjectModel;

namespace PlexLocalScan.Shared.Configuration.Options;

public class PlexOptions
{
    public string Host { get; init; } = "localhost";
    public int Port { get; init; } = 32400;
    public string PlexToken { get; init; } = "plex-token-here";
    public Collection<FolderMappingOptions> FolderMappings { get; init; } = [];
    public int PollingInterval { get; init; } = 30;
    public int ProcessNewFolderDelay { get; init; } = 0;
    public string ApiEndpoint => $"http://{Host}:{Port}";
}
