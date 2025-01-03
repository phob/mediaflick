using Microsoft.Extensions.Logging;
using PlexLocalScan.Core.Media;
using PlexLocalScan.Core.Tables;
using PlexLocalScan.Core.Helper;
using PlexLocalScan.FileTracking.Services;
using PlexLocalScan.Shared.Interfaces;

namespace PlexLocalScan.Shared.Services;

public class SymlinkHandler(
    ILogger<SymlinkHandler> logger,
    IContextService contextService)
    : ISymlinkHandler
{
    private readonly SymlinkHelper _symlinkHelper = new();

    public async Task<bool> CreateSymlinksAsync(string sourceFile, string destinationFolder, MediaInfo? mediaInfo, MediaType mediaType)
    {
        try
        {
            var extension = Path.GetExtension(sourceFile);
            if (!_symlinkHelper.IsVideoFile(extension)) return false;

            if (mediaInfo == null)
            {
                await CreateFallbackSymlinkAsync(sourceFile, destinationFolder, mediaType);
                return false;
            }

            var (targetPath, targetFileName) = GetTargetPath(mediaInfo, destinationFolder, extension);
            return await CreateSymlinkWithStructureAsync(sourceFile, targetPath, targetFileName);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error creating symlinks from {Source} to {Destination}", 
                sourceFile, destinationFolder);
            throw;
        }
    }

    private async Task<bool> CreateFallbackSymlinkAsync(string sourceFile, string destinationFolder, MediaType mediaType)
    {
        try
        {
            var emptyMediaInfo = new MediaInfo
            {
                MediaType = mediaType
            };
            var sourceDirectory = Path.GetDirectoryName(sourceFile) 
                ?? throw new InvalidOperationException("Unable to get source directory");
            var fileName = Path.GetFileName(sourceFile);

            var lastDirName = new DirectoryInfo(sourceDirectory).Name;

            var targetPath = Path.Combine(destinationFolder, lastDirName);
            var fullTargetPath = Path.Combine(targetPath, fileName);

            Directory.CreateDirectory(targetPath);

            if (await _symlinkHelper.CreateFileLinkAsync(sourceFile, fullTargetPath))
            {
                await contextService.UpdateStatusAsync(sourceFile, fullTargetPath, emptyMediaInfo, FileStatus.Failed);
                return true;
            }
            
            logger.LogInformation("Created fallback symlink for undetected media: {SourceFile} -> {TargetPath}", 
                sourceFile, fullTargetPath);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create fallback symlink for {SourceFile}", sourceFile);
            throw;
        }
        return false;
    }

    private (string path, string fileName) GetTargetPath(MediaInfo? mediaInfo, string baseFolder, string extension)
    {
        try
        {
            if (mediaInfo is {MediaType: MediaType.Movies})
            {
                var (folderPath, fileName) = PathFormatHelper.FormatMoviePath(mediaInfo);
                return (Path.Combine(baseFolder, folderPath), fileName + extension);
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

    private async Task<bool> CreateSymlinkWithStructureAsync(string sourcePath, string targetPath, string targetFileName)
    {
        try
        {
            var emptyMediaInfo = new MediaInfo();
            Directory.CreateDirectory(targetPath);

            var fullTargetPath = Path.Combine(targetPath, targetFileName);

            if (File.Exists(fullTargetPath))
            {
                if (_symlinkHelper.IsSymlink(fullTargetPath))
                {
                    logger.LogDebug("Symlink already exists: {TargetPath}", fullTargetPath);
                    await contextService.UpdateStatusAsync(sourcePath, fullTargetPath, emptyMediaInfo, FileStatus.Duplicate);
                    return false;
                }
                File.Delete(fullTargetPath);
            }

            if(await _symlinkHelper.CreateFileLinkAsync(sourcePath, fullTargetPath))
                await contextService.UpdateStatusAsync(sourcePath, fullTargetPath, emptyMediaInfo, FileStatus.Duplicate);
            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create symlink structure from {Source} to {Target}", 
                sourcePath, Path.Combine(targetPath, targetFileName));
            return false;
        }
    }

} 