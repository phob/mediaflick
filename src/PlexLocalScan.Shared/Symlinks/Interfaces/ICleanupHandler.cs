namespace PlexLocalScan.Shared.Symlinks.Interfaces;

public interface ICleanupHandler
{
    Task CleanupDeadSymlinksAsync(string baseFolder);
    Task CleanupDeletedSourceFolderAsync(string sourceFolder);
    bool IsSymbolicLinkDead(string symlinkPath);
    bool IsDirectoryEmpty(string path);
} 