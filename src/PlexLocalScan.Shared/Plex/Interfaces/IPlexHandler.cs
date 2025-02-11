namespace PlexLocalScan.Shared.Plex.Interfaces;

public enum FolderAction
{
    Refresh,
    Delete,
}

public interface IPlexHandler
{
    Task UpdateFolderForScanningAsync(
        string folderPath,
        FolderAction action = FolderAction.Refresh
    );
}
