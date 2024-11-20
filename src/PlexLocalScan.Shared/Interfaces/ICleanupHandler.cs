namespace PlexLocalScan.Shared.Interfaces;

public interface ICleanupHandler
{
    Task CleanupDeadSymlinksAsync(string baseFolder);
    bool IsSymbolicLinkDead(string symlinkPath);
    bool IsDirectoryEmpty(string path);
} 