using System.Collections.Concurrent;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using PlexLocalScan.Core.Tables;
using PlexLocalScan.Data.Data;
using PlexLocalScan.Shared.Configuration.Options;
using PlexLocalScan.Shared.DbContext.Interfaces;
using PlexLocalScan.Shared.MediaDetection.Interfaces;
using PlexLocalScan.Shared.Plex.Interfaces;
using PlexLocalScan.Shared.Symlinks.Interfaces;

namespace PlexLocalScan.Shared.Services;

public class FileProcessing(
    ILogger<FileProcessing> logger,
    IPlexHandler plexHandler,
    PlexScanContext dbContext,
    ICleanupHandler cleanupHandler,
    ISymlinkHandler symlinkHandler,
    IMediaDetectionService mediaDetectionService,
    IContextService contextService
) : IFileProcessing
{
    public async Task ProcessAllMappingsAsync(
        PlexOptions plexOptions,
        ConcurrentDictionary<string, HashSet<string>> knownFolders
    )
    {
        // Create a list to store all files that need to be deleted from the database
        var filesToDelete = new List<ScannedFile>();

        await ProcessFilesInFolder(plexOptions, knownFolders, filesToDelete);

        await RemoveFilesFromScannedFiles(filesToDelete);
    }

    private async Task ProcessFilesInFolder(
        PlexOptions plexOptions,
        ConcurrentDictionary<string, HashSet<string>> knownFolders,
        List<ScannedFile> filesToDelete
    )
    {
        foreach (var folderMapping in plexOptions.FolderMappings)
        {
            var folderMappingSourcePath = Path.GetFullPath(folderMapping.SourceFolder);

            if (!Directory.Exists(folderMappingSourcePath))
            {
                logger.LogWarning(
                    "Source folder no longer exists: {SourceFolder}",
                    folderMappingSourcePath
                );
                await cleanupHandler.CleanupDeletedSourceFolderAsync(folderMappingSourcePath);
                continue;
            }

            var currentSourceSubFolders = new HashSet<string>(
                Directory.GetDirectories(folderMappingSourcePath)
            );

            // Check for deleted folders
            if (knownFolders.TryGetValue(folderMapping.SourceFolder, out var previousFolders))
            {
                var deletedFolders = previousFolders.Except(currentSourceSubFolders).ToList();
                foreach (var deletedFolder in deletedFolders)
                {
                    logger.LogInformation("Folder was deleted: {FolderPath}", deletedFolder);
                    await cleanupHandler.CleanupDeletedSourceFolderAsync(deletedFolder);
                }
            }

            // Get all tracked files for this source folder - optimize by selecting only necessary fields
            var filesAlreadyInDb = await dbContext
                .ScannedFiles.Where(f => f.SourceFile.StartsWith(folderMappingSourcePath))
                .Select(f => new
                {
                    f.SourceFile,
                    f.DestFile,
                    f.Id,
                })
                .ToListAsync();

            var filePathsAlreadyInDb = new HashSet<string>(
                filesAlreadyInDb.Select(f => f.SourceFile)
            );

            // Check for deleted files in batch
            var deletedFiles = filesAlreadyInDb
                .Where(trackedFile => !File.Exists(trackedFile.SourceFile))
                .ToList();
            foreach (var trackedFile in deletedFiles)
            {
                logger.LogInformation(
                    "Source file was deleted: {SourceFile}",
                    trackedFile.SourceFile
                );

                // Delete destination file if it exists
                if (
                    !string.IsNullOrEmpty(trackedFile.DestFile) && File.Exists(trackedFile.DestFile)
                )
                {
                    try
                    {
                        File.Delete(trackedFile.DestFile);
                        logger.LogInformation(
                            "Deleted destination file: {DestFile}",
                            trackedFile.DestFile
                        );

                    }
                    catch (Exception ex)
                    {
                        logger.LogError(
                            ex,
                            "Error deleting destination file: {DestFile}",
                            trackedFile.DestFile
                        );
                    }
                }

                // Add to the list of files to delete from database
                filesToDelete.Add(new ScannedFile { Id = trackedFile.Id });
            }

            // Scan for untracked files
            await ScanForUntrackedFilesAsync(
                folderMappingSourcePath,
                filePathsAlreadyInDb,
                folderMapping
            );

            // Clean up empty directories in destination folder
            if (Directory.Exists(folderMapping.DestinationFolder))
            {
                await cleanupHandler.CleanupDeadSymlinksAsync(folderMapping.DestinationFolder);
            }

            // Update known folders for future reference
            knownFolders[folderMapping.SourceFolder] = [.. currentSourceSubFolders];
        }
    }

    private async Task RemoveFilesFromScannedFiles(List<ScannedFile> filesToDelete)
    {
        // Batch delete files from database
        if (filesToDelete.Count != 0)
        {
            dbContext.ScannedFiles.RemoveRange(filesToDelete);
            await dbContext.SaveChangesAsync();
        }
    }

    private async Task ProcessSingleFileAsync(
        string file,
        string destinationFolder,
        FolderMappingOptions mapping
    )
    {
        try
        {
            var trackedFile = await contextService.AddStatusAsync(file, null, mapping.MediaType);
            if (trackedFile == null)
            {
                return;
            }

            var mediaInfo = await mediaDetectionService.DetectMediaAsync(file, mapping.MediaType);

            if (
                await symlinkHandler.CreateSymlinksAsync(
                    file,
                    destinationFolder,
                    mediaInfo,
                    mapping.MediaType
                )
            )
            {
                _ = await contextService.UpdateStatusAsync(
                    file,
                    null,
                    mediaInfo,
                    FileStatus.Success
                );
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error processing file: {File}", file);
        }
    }

    private async Task ScanForUntrackedFilesAsync(
        string sourceFolder,
        HashSet<string> trackedFiles,
        FolderMappingOptions mapping
    )
    {
        try
        {
            // Get all files in the source folder recursively
            var allFiles = Directory.EnumerateFiles(
                sourceFolder,
                "*.*",
                SearchOption.AllDirectories
            );

            // Process files in batches to avoid memory pressure
            const int batchSize = 100;
            var untrackedFiles = allFiles
                .Where(file => !trackedFiles.Contains(file))
                .Select(file => new { File = file, Folder = Path.GetDirectoryName(file)! })
                .GroupBy(x => x.Folder);

            foreach (var folderGroup in untrackedFiles)
            {
                logger.LogInformation(
                    "Processing untracked files in folder: {Folder}",
                    folderGroup.Key
                );
                var destinationFolder = Path.Combine(mapping.DestinationFolder);
                var files = folderGroup.Select(x => x.File);

                foreach (var batch in files.Chunk(batchSize))
                {
                    foreach (var file in batch)
                    {
                        await ProcessSingleFileAsync(file, destinationFolder, mapping);
                    }
                }

                // Trigger Plex scan after processing each folder
                await plexHandler.UpdateFolderForScanningAsync(destinationFolder);
            }
        }
        catch (Exception ex)
        {
            logger.LogError(
                ex,
                "Error scanning for untracked files in folder: {Folder}",
                sourceFolder
            );
        }
    }
}

public interface IFileProcessing
{
    Task ProcessAllMappingsAsync(
        PlexOptions plexOptions,
        ConcurrentDictionary<string, HashSet<string>> knownFolders
    );
}
