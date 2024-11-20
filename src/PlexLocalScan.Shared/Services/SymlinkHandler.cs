using Microsoft.Extensions.Logging;
using System.Runtime.InteropServices;
using PlexLocalScan.Data.Models;
using PlexLocalScan.Shared.Interfaces;
using System.Diagnostics;
using System.IO;

namespace PlexLocalScan.Shared.Services;

public class SymlinkHandler : ISymlinkHandler
{
    private readonly ILogger<SymlinkHandler> _logger;
    private readonly IFileTrackingService _fileTrackingService;
    private static readonly string[] sourceArray = [".mkv", ".mp4", ".avi"];

    public SymlinkHandler(
        ILogger<SymlinkHandler> logger,
        IFileTrackingService fileTrackingService)
    {
        _logger = logger;
        _fileTrackingService = fileTrackingService;        
    }

    public async Task CreateSymlinksAsync(string sourceFile, string destinationFolder, MediaInfo mediaInfo)
    {
        try
        {
            var extension = Path.GetExtension(sourceFile);
            if (!IsVideoFile(extension)) return;


            if (mediaInfo == null)
            {
                await _fileTrackingService.UpdateStatusAsync(sourceFile, null, MediaType.Unknown, null, FileStatus.Failed);
                _logger.LogWarning("Could not detect media info for {SourcePath}, skipping", sourceFile);
                return;
            }

            var (targetPath, targetFileName) = GetTargetPath(mediaInfo, destinationFolder, extension);
            await CreateSymlinkWithStructureAsync(sourceFile, targetPath, targetFileName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error creating symlinks from {Source} to {Destination}", 
                sourceFile, destinationFolder);
            throw;
        }
    }

    private (string path, string fileName) GetTargetPath(MediaInfo mediaInfo, string baseFolder, string extension)
    {
        try
        {
            if (mediaInfo.MediaType == MediaType.Movies)
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
            _logger.LogError(ex, "Error formatting path for {MediaType}: {Title}", 
                mediaInfo.MediaType, mediaInfo.Title);
            throw;
        }
    }

    private async Task CreateSymlinkWithStructureAsync(string sourcePath, string targetPath, string targetFileName)
    {
        try
        {
            // Create all necessary directories
            Directory.CreateDirectory(targetPath);

            var fullTargetPath = Path.Combine(targetPath, targetFileName);

            if (File.Exists(fullTargetPath))
            {
                if (IsSymlink(fullTargetPath))
                {
                    _logger.LogDebug("Symlink already exists: {TargetPath}", fullTargetPath);
                    return;
                }
                File.Delete(fullTargetPath);
            }

            await CreateFileLinkAsync(sourcePath, fullTargetPath);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create symlink structure from {Source} to {Target}", 
                sourcePath, Path.Combine(targetPath, targetFileName));
            throw;
        }
    }

    private static bool IsVideoFile(string extension)
    {
        return sourceArray.Contains(extension.ToLower());
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
            await _fileTrackingService.UpdateStatusAsync(sourcePath, destinationPath, null, null, FileStatus.Success);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create symlink from {Source} to {Destination}", 
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