namespace PlexLocalScan.Data.Data;

public class PlexDbOptions
{
    public int Id { get; set; }
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; }
    public string PlexToken { get; set; } = string.Empty;
    public int PollingInterval { get; set; }
    public int ProcessNewFolderDelay { get; set; }
    public ICollection<FolderMappingDbOptions> FolderMappings { get; } = [];
}
