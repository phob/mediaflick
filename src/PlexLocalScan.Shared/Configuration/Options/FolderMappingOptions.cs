using PlexLocalScan.Core.Tables;

namespace PlexLocalScan.Shared.Configuration.Options;

public class FolderMappingOptions
{
    public string SourceFolder { get; set; } = "/mnt/zurg/movies";
    public string DestinationFolder { get; set; } = "/mnt/organized/movies";
    public MediaType MediaType { get; set; } = MediaType.Movies;
}

