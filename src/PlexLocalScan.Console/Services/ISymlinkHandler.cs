namespace PlexLocalScan.Services;

public interface ISymlinkHandler
{
    Task CreateSymlinksAsync(string sourceFolder, string destinationFolder, MediaInfo mediaInfo);
    bool IsSymlink(string path);
} 