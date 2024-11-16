using PlexLocalScan.Shared.Services;
namespace PlexLocalScan.Shared.Interfaces;

public interface ISymlinkHandler
{
    Task CreateSymlinksAsync(string sourceFolder, string destinationFolder, MediaInfo mediaInfo);
    bool IsSymlink(string path);
}