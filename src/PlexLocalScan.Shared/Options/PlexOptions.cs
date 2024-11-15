using PlexLocalScan.Data.Models;
namespace PlexLocalScan.Shared.Options;

public class PlexOptions
{
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; }
    public string PlexToken { get; set; } = string.Empty;
    public List<FolderMapping> FolderMappings { get; set; } = new();
    public int PollingInterval { get; set; } = 30;
    public int FileWatcherPeriod { get; set; }
    public string ApiEndpoint => $"http://{Host}:{Port}";
    public string TMDbApiKey { get; set; } = string.Empty;
}

public class TMDbOptions
{
    public string ApiKey { get; set; } = string.Empty;
}

public class FolderMapping
{
    public string SourceFolder { get; set; } = string.Empty;
    public string DestinationFolder { get; set; } = string.Empty;
    public MediaType MediaType { get; set; }
}

