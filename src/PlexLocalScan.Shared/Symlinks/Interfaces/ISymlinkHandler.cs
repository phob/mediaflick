using PlexLocalScan.Core.Media;
using PlexLocalScan.Core.Tables;

namespace PlexLocalScan.Shared.Symlinks.Interfaces;

public interface ISymlinkHandler
{
    Task<bool> CreateSymlinksAsync(string sourceFile, string destinationFolder, MediaInfo? mediaInfo, MediaType mediaType);
    
}