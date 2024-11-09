namespace PlexLocalscan.Options;

public class PlexOptions
{
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; }
    public string PlexToken { get; set; } = string.Empty;
    public List<string> FoldersToScan { get; set; } = new();
    public int PollingInterval { get; set; } = 30;
    public int FileWatcherPeriod { get; set; }
    public string ApiEndpoint => $"http://{Host}:{Port}";
} 