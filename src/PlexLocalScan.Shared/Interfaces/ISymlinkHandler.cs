using PlexLocalScan.Shared.Services;
namespace PlexLocalScan.Shared.Interfaces;

public interface ISymlinkHandler
{
    Task CreateSymlinksAsync(string sourceFile, string destinationFolder, MediaInfo? mediaInfo, Data.Models.MediaType mediaType);
    bool IsSymlink(string path);
}