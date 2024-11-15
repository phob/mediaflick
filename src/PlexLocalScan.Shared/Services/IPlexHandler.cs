namespace PlexLocalScan.Shared.Services;

public interface IPlexHandler
{
    Task AddFolderForScanningAsync(string folderPath, string baseFolder);
    Task DeleteFolderFromPlexAsync(string folderPath);
} 