using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PlexLocalScan.Core.Helper;
using PlexLocalScan.Data.Data;
using PlexLocalScan.Shared.Interfaces;

namespace PlexLocalScan.Shared.Symlinks.Services;

public class CleanupHandler(
    ILogger<CleanupHandler> logger,
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
            throw new InvalidOperationException($"Error cleaning up dead symlinks in {baseFolder}", ex);
        }
    }

    private void RemoveDeadSymlinks(string folder)
    {
        try
        {
            Directory.GetFiles(folder, "*.*", SearchOption.AllDirectories)
                .Where(SymlinkHelper.IsSymlink)
                .Where(IsSymbolicLinkDead)
                .ToList()
                .ForEach(file =>
                {
                    logger.LogDebug("Removing dead symlink: {Path} -> {Target}", file, new FileInfo(file).LinkTarget);
                    File.Delete(file);
                });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error removing dead symlinks in {Folder}", folder);
            throw new InvalidOperationException($"Error removing dead symlinks in {folder}", ex);
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

            return !File.Exists(new FileInfo(symlinkPath).LinkTarget);
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
            Directory.GetDirectories(folder, "*", SearchOption.AllDirectories)
                .Where(IsDirectoryEmpty)
                .OrderByDescending(x => x.Length)
                .ToList()
                .ForEach(directory =>
                {
                    logger.LogInformation("Removing empty directory: {Path}", directory);
                    Directory.Delete(directory);
                });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error removing empty directories in {Folder}", folder);
            throw new InvalidOperationException($"Error removing empty directories in {folder}", ex);
        }
    }

    public bool IsDirectoryEmpty(string path) => !Directory.EnumerateFileSystemEntries(path).Any();

    public async Task CleanupDeletedSourceFolderAsync(string sourceFolder)
    {
        try
        {
            // Get all records for the deleted source folder
            var affectedFiles = await dbContext.ScannedFiles
                .Where(f => f.SourceFile.StartsWith(sourceFolder))
                .ToListAsync();

            if (affectedFiles.Count == 0)
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
#pragma warning disable S3267 // Loops should be simplified with "LINQ" expressions
            foreach (var file in affectedFiles.Where(f => !string.IsNullOrEmpty(f.DestFile)))
            {
                try
                {
                    if (!File.Exists(file.DestFile))
                    {
                        continue;
                    }

                    File.Delete(file.DestFile);
                    logger.LogInformation("Deleted destination file: {DestFile}", file.DestFile);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Error deleting destination file: {DestFile}", file.DestFile);
                }
            }
#pragma warning restore S3267 // Loops should be simplified with "LINQ" expressions

            // Clean up empty directories
            foreach (var folder in destFolders.OfType<string>().Where(Directory.Exists))
            {
                RemoveEmptyDirectories(folder);
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
            throw new InvalidOperationException($"Error cleaning up deleted source folder: {sourceFolder}", ex);
        }
    }
}
