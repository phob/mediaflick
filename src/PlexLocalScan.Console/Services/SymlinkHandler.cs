using Microsoft.Extensions.Logging;
using System.Runtime.InteropServices;
using PlexLocalScan.Console.Options;
using PlexLocalScan.Console.Models;

namespace PlexLocalScan.Console.Services;

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
            if (File.Exists(destinationPath))
            {
                File.Delete(destinationPath);
            }

            await Task.Run(() =>
            {
                if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
                {
                    _logger.LogDebug("Creating Windows symlink: {Destination} -> {Source}", 
                        destinationPath, sourcePath);
                    CreateWindowsSymlink(sourcePath, destinationPath);
                }
                else
                {
                    _logger.LogDebug("Creating Unix symlink: {Destination} -> {Source}", 
                        destinationPath, sourcePath);
                    CreateUnixSymlink(sourcePath, destinationPath);
                }
            });
            await _fileTrackingService.UpdateStatusAsync(sourcePath, destinationPath, null, null, FileStatus.Success);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create symlink from {Source} to {Destination}", 
                sourcePath, destinationPath);
            throw;
        }
    }

    private void CreateWindowsSymlink(string sourcePath, string destinationPath)
    {
        var process = new System.Diagnostics.Process
        {
            StartInfo = new System.Diagnostics.ProcessStartInfo
            {
                FileName = "cmd.exe",
                Arguments = $"/C mklink \"{destinationPath}\" \"{sourcePath}\"",
                UseShellExecute = false,
                RedirectStandardOutput = true,
                CreateNoWindow = true
            }
        };
        
        process.Start();
        process.WaitForExit();

        if (process.ExitCode != 0)
        {
            throw new Exception($"Failed to create Windows symlink. Exit code: {process.ExitCode}");
        }
    }

    private void CreateUnixSymlink(string sourcePath, string destinationPath)
    {
        var process = new System.Diagnostics.Process
        {
            StartInfo = new System.Diagnostics.ProcessStartInfo
            {
                FileName = "ln",
                Arguments = $"-s \"{sourcePath}\" \"{destinationPath}\"",
                UseShellExecute = false,
                RedirectStandardOutput = true,
                CreateNoWindow = true
            }
        };
        
        process.Start();
        process.WaitForExit();

        if (process.ExitCode != 0)
        {
            throw new Exception($"Failed to create Unix symlink. Exit code: {process.ExitCode}");
        }
    }

    public bool IsSymlink(string path)
    {
        if (!File.Exists(path)) return false;
        
        var fileInfo = new FileInfo(path);
        return fileInfo.Attributes.HasFlag(FileAttributes.ReparsePoint);
    }
} 