namespace PlexLocalScan.Shared.Plex.Interfaces;

public interface IPlexHandler
{
    Task AddFolderForScanningAsync(string folderPath, string baseFolder);
    Task DeleteFolderFromPlexAsync(string folderPath);
}
