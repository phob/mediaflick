using PlexLocalScan.Data.Models;
namespace PlexLocalScan.Shared.Options;

public class FolderMapping
{
    public string SourceFolder { get; set; } = string.Empty;
    public string DestinationFolder { get; set; } = string.Empty;
    public MediaType MediaType { get; set; }
}

