using System.Collections.ObjectModel;

namespace PlexLocalScan.Shared.Options;

public class PlexOptions
{
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; }
    public string PlexToken { get; set; } = string.Empty;
    public ICollection<FolderMappingOptions> FolderMappings { get; } = [];
    public int PollingInterval { get; set; } = 30;
    public int ProcessNewFolderDelay { get; set; }
    public string ApiEndpoint => $"http://{Host}:{Port}";
}
