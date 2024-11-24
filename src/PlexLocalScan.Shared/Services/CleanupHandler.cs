using Microsoft.Extensions.Logging;
using PlexLocalScan.Shared.Interfaces;
using Microsoft.EntityFrameworkCore;
using PlexLocalScan.Data.Data;

namespace PlexLocalScan.Shared.Services;

public class CleanupHandler(
    ILogger<CleanupHandler> logger,
    ISymlinkHandler symlinkHandler,
    PlexScanContext dbContext)
    : ICleanupHandler
{
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
            logger.LogError(ex, "Error cleaning up dead symlinks in {BaseFolder}", baseFolder);
            throw;
        }
    }

    private void RemoveDeadSymlinks(string folder)
    {
        try
        {
            foreach (var file in Directory.GetFiles(folder, "*.*", SearchOption.AllDirectories))
            {
                if (symlinkHandler.IsSymlink(file))
                {
                    if (IsSymbolicLinkDead(file))
                    {
                        logger.LogDebug("Removing dead symlink: {Path}", file);
                        File.Delete(file);
                    }
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error removing dead symlinks in {Folder}", folder);
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
                    logger.LogInformation("Removing empty directory: {Path}", directory);
                    Directory.Delete(directory);
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error removing empty directories in {Folder}", folder);
            throw;
        }
    }

    public bool IsDirectoryEmpty(string path)
    {
        return !Directory.EnumerateFileSystemEntries(path).Any();
    }

    public async Task CleanupDeletedSourceFolderAsync(string sourceFolder)
    {
        try
        {
            // Get all records for the deleted source folder
            var affectedFiles = await dbContext.ScannedFiles
                .Where(f => f.SourceFile.StartsWith(sourceFolder))
                .ToListAsync();

            if (!affectedFiles.Any())
            {
                logger.LogInformation("No files found for deleted source folder: {SourceFolder}", sourceFolder);
                return;
            }

            // Get unique destination folders for cleanup
            var destFolders = affectedFiles
                .Select(f => Path.GetDirectoryName(f.DestFile))
                .Where(d => d != null)
                .Distinct()
                .ToList();

            // Delete all destination files
            foreach (var file in affectedFiles.Where(f => !string.IsNullOrEmpty(f.DestFile)))
            {
                try
                {
                    if (File.Exists(file.DestFile))
                    {
                        File.Delete(file.DestFile);
                        logger.LogInformation("Deleted destination file: {DestFile}", file.DestFile);
                    }
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Error deleting destination file: {DestFile}", file.DestFile);
                }
            }

            // Clean up empty directories
            foreach (var folder in destFolders)
            {
                if (folder != null && Directory.Exists(folder))
                {
                    RemoveEmptyDirectories(folder);
                }
            }

            // Remove database entries
            dbContext.ScannedFiles.RemoveRange(affectedFiles);
            await dbContext.SaveChangesAsync();
            
            logger.LogInformation("Cleaned up {Count} files for deleted source folder: {SourceFolder}", 
                affectedFiles.Count, sourceFolder);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error cleaning up deleted source folder: {SourceFolder}", sourceFolder);
            throw;
        }
    }
} 