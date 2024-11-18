using PlexLocalScan.Shared.Services;
namespace PlexLocalScan.Shared.Interfaces;

public interface ISymlinkHandler
{
    Task CreateSymlinksAsync(string sourceFile, string destinationFolder, MediaInfo mediaInfo);
    Task CleanupDeadSymlinksAsync(string baseFolder);
    bool IsSymlink(string path);
}