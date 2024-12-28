using PlexLocalScan.Core.Media;
using PlexLocalScan.Core.Tables;

namespace PlexLocalScan.Shared.Interfaces;

public interface ISymlinkHandler
{
    Task CreateSymlinksAsync(string sourceFile, string destinationFolder, MediaInfo? mediaInfo, MediaType mediaType);
    bool IsSymlink(string path);
}