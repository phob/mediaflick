using Microsoft.Extensions.Logging;
using PlexLocalScan.Shared.Interfaces;

namespace PlexLocalScan.Shared.Services;

public class CleanupHandler : ICleanupHandler
{
    private readonly ILogger<CleanupHandler> _logger;
    private readonly ISymlinkHandler _symlinkHandler;

    public CleanupHandler(
        ILogger<CleanupHandler> logger,
        ISymlinkHandler symlinkHandler)
    {
        _logger = logger;
        _symlinkHandler = symlinkHandler;
    }

    public async Task CleanupDeadSymlinksAsync(string baseFolder)
    {
        try
        {
            await Task.Run(() =>
            {
                // First remove dead symlinks
                RemoveDeadSymlinks(baseFolder);
                
                // Then remove empty directories
                RemoveEmptyDirectories(baseFolder);
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error cleaning up dead symlinks in {BaseFolder}", baseFolder);
            throw;
        }
    }

    private void RemoveDeadSymlinks(string folder)
    {
        try
        {
            foreach (var file in Directory.GetFiles(folder, "*.*", SearchOption.AllDirectories))
            {
                if (_symlinkHandler.IsSymlink(file))
                {
                    if (IsSymbolicLinkDead(file))
                    {
                        _logger.LogDebug("Removing dead symlink: {Path}", file);
                        File.Delete(file);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing dead symlinks in {Folder}", folder);
            throw;
        }
    }

    public bool IsSymbolicLinkDead(string symlinkPath)
    {
        try
        {
            if (!File.Exists(symlinkPath))
            {
                return true;
            }

            using var stream = File.OpenRead(symlinkPath);
            var buffer = new byte[1];
            return stream.Read(buffer, 0, 1) <= 0;
        }
        catch
        {
            return true;
        }
    }

    private void RemoveEmptyDirectories(string folder)
    {
        try
        {
            foreach (var directory in Directory.GetDirectories(folder, "*", SearchOption.AllDirectories)
                                             .OrderByDescending(x => x.Length))
            {
                if (IsDirectoryEmpty(directory))
                {
                    _logger.LogInformation("Removing empty directory: {Path}", directory);
                    Directory.Delete(directory);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing empty directories in {Folder}", folder);
            throw;
        }
    }

    public bool IsDirectoryEmpty(string path)
    {
        return !Directory.EnumerateFileSystemEntries(path).Any();
    }
} 