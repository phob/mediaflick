using Microsoft.Extensions.Logging;
using PlexLocalScan.Data.Models;
using PlexLocalScan.Shared.Interfaces;
using PlexLocalScan.Shared.Models.Media;

namespace PlexLocalScan.Shared.Services;

public class SymlinkHandler(
    ILogger<SymlinkHandler> logger,
    IFileTrackingService fileTrackingService)
    : ISymlinkHandler
{
    private static readonly string[] SourceArray = [".mkv", ".mp4", ".avi"];

    public async Task CreateSymlinksAsync(string sourceFile, string destinationFolder, MediaInfo? mediaInfo, MediaType mediaType)
    {
        try
        {
            var extension = Path.GetExtension(sourceFile);
            if (!IsVideoFile(extension)) return;

            if (mediaInfo == null)
            {
                await CreateFallbackSymlinkAsync(sourceFile, destinationFolder, mediaType);
                return;
            }

            var (targetPath, targetFileName) = GetTargetPath(mediaInfo, destinationFolder, extension);
            await CreateSymlinkWithStructureAsync(sourceFile, targetPath, targetFileName);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error creating symlinks from {Source} to {Destination}", 
                sourceFile, destinationFolder);
            throw;
        }
    }

    private async Task CreateFallbackSymlinkAsync(string sourceFile, string destinationFolder, MediaType mediaType)
    {
        try
        {
            var sourceDirectory = Path.GetDirectoryName(sourceFile) 
                ?? throw new InvalidOperationException("Unable to get source directory");
            var fileName = Path.GetFileName(sourceFile);

            var lastDirName = new DirectoryInfo(sourceDirectory).Name;

            var targetPath = Path.Combine(destinationFolder, lastDirName);
            var fullTargetPath = Path.Combine(targetPath, fileName);

            Directory.CreateDirectory(targetPath);

            await CreateFileLinkAsync(sourceFile, fullTargetPath);
            
            await fileTrackingService.UpdateStatusAsync(sourceFile, fullTargetPath, mediaType, null, null, FileStatus.Failed);
            
            logger.LogInformation("Created fallback symlink for undetected media: {SourceFile} -> {TargetPath}", 
                sourceFile, fullTargetPath);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create fallback symlink for {SourceFile}", sourceFile);
            throw;
        }
    }

    private (string path, string fileName) GetTargetPath(MediaInfo? mediaInfo, string baseFolder, string extension)
    {
        try
        {
            if (mediaInfo is {MediaType: MediaType.Movies})
            {
                var movieName = PathFormatHelper.FormatMoviePath(mediaInfo);
                return (baseFolder, movieName + extension);
            }
            else
            {
                var (folderPath, fileName) = PathFormatHelper.FormatTvShowPath(mediaInfo);
                return (Path.Combine(baseFolder, folderPath), fileName + extension);
            }
        }
        catch (Exception ex)
        {
            if (mediaInfo != null)
                logger.LogError(ex, "Error formatting path for {MediaType}: {Title}",
                    mediaInfo.MediaType, mediaInfo.Title);
            throw;
        }
    }

    private async Task CreateSymlinkWithStructureAsync(string sourcePath, string targetPath, string targetFileName)
    {
        try
        {
            Directory.CreateDirectory(targetPath);

            var fullTargetPath = Path.Combine(targetPath, targetFileName);

            if (File.Exists(fullTargetPath))
            {
                if (IsSymlink(fullTargetPath))
                {
                    logger.LogDebug("Symlink already exists: {TargetPath}", fullTargetPath);
                    await fileTrackingService.UpdateStatusAsync(sourcePath, fullTargetPath, null, null, null, FileStatus.Success);
                    return;
                }
                File.Delete(fullTargetPath);
            }

            await CreateFileLinkAsync(sourcePath, fullTargetPath);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create symlink structure from {Source} to {Target}", 
                sourcePath, Path.Combine(targetPath, targetFileName));
            throw;
        }
    }

    private static bool IsVideoFile(string extension)
    {
        return SourceArray.Contains(extension.ToLower());
    }

    private async Task CreateFileLinkAsync(string sourcePath, string destinationPath)
    {
        try
        {
            if (await Task.Run(() => File.Exists(destinationPath)))
            {
                await Task.Run(() => File.Delete(destinationPath));
            }

            await Task.Run(() => File.CreateSymbolicLink(destinationPath, sourcePath));
            await fileTrackingService.UpdateStatusAsync(sourcePath, destinationPath, null, null, null, FileStatus.Success);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create symlink from {Source} to {Destination}", 
                sourcePath, destinationPath);
            throw;
        }
    }

    public bool IsSymlink(string path)
    {
        if (!File.Exists(path)) return false;
        
        var fileInfo = new FileInfo(path);
        return fileInfo.Attributes.HasFlag(FileAttributes.ReparsePoint);
    }
} 