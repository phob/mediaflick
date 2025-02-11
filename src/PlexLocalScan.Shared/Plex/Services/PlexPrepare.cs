using System.Collections.ObjectModel;

using Microsoft.Extensions.Options;

using PlexLocalScan.Shared.Configuration.Options;
using PlexLocalScan.Shared.Plex.Interfaces;

public class PlexPrepare
{
    public static Dictionary<string, HashSet<string>> SnapshotBefore(Collection<FolderMappingOptions> folderMappings)
    {
        // Get list of all destination files before recreation
        var beforeFiles = new Dictionary<string, HashSet<string>>();
        foreach (var mapping in folderMappings)
        {
            if (Directory.Exists(mapping.DestinationFolder))
            {
                beforeFiles[mapping.DestinationFolder] = [.. Directory.GetFiles(mapping.DestinationFolder, "*", SearchOption.AllDirectories)];
            }
        }

        return beforeFiles;
    }

    public static Dictionary<string, FolderAction> SnapshotAfter(Collection<FolderMappingOptions> folderMappings, Dictionary<string, HashSet<string>> beforeFiles)
    {
        // Get list of all destination files after recreation
        var afterFiles = new Dictionary<string, HashSet<string>>();
        foreach (var mapping in folderMappings)
        {
            if (Directory.Exists(mapping.DestinationFolder))
            {
                afterFiles[mapping.DestinationFolder] = [.. Directory.GetFiles(mapping.DestinationFolder, "*", SearchOption.AllDirectories)];
            }
        }

        // Track changes per directory
        var directoryChanges = new Dictionary<string, FolderAction>();

        // Compare before and after states for each folder mapping
        foreach (var mapping in folderMappings)
        {
            var basePath = mapping.DestinationFolder;

            // Skip if folder doesn't exist
            if (!Directory.Exists(basePath)) continue;

            var beforeSet = beforeFiles.GetValueOrDefault(basePath, []);
            var afterSet = afterFiles.GetValueOrDefault(basePath, []);

            // Get all directories that had files before or after
            var allDirs = new HashSet<string>();
            foreach (var file in beforeSet.Union(afterSet))
            {
                allDirs.Add(Path.GetDirectoryName(file)!);
            }

            // Check each directory for changes
            foreach (var dir in allDirs)
            {
                var beforeDirFiles = beforeSet.Where(f => Path.GetDirectoryName(f) == dir).ToList();
                var afterDirFiles = afterSet.Where(f => Path.GetDirectoryName(f) == dir).ToList();

                if (beforeDirFiles.Count != 0 && afterDirFiles.Count == 0)
                {
                    // All files in directory were deleted
                    directoryChanges[dir] = FolderAction.Delete;
                }
                else if (!beforeDirFiles.SequenceEqual(afterDirFiles))
                {
                    // Files were changed (created, modified, or partially deleted)
                    directoryChanges[dir] = FolderAction.Refresh;
                }
            }
        }

        return directoryChanges;
    }

}
