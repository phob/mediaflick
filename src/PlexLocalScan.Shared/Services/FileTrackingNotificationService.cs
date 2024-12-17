using PlexLocalScan.Data.Models;
using PlexLocalScan.Shared.Models;
using PlexLocalScan.Shared.Interfaces;

namespace PlexLocalScan.Shared.Services;

/// <summary>
/// Service for sending file tracking notifications through SignalR
/// </summary>
public class FileTrackingNotificationService(IFileTrackingHub hubContext)
{
    /// <summary>
    /// Notifies clients that a file has been added to tracking
    /// </summary>
    public async Task NotifyFileAdded(ScannedFile file)
    {
        await hubContext.OnFileAdded(ScannedFileDto.FromScannedFile(file));
    }

    /// <summary>
    /// Notifies clients that a file has been removed from tracking
    /// </summary>
    public async Task NotifyFileRemoved(ScannedFile file)
    {
        await hubContext.OnFileRemoved(ScannedFileDto.FromScannedFile(file));
    }

    /// <summary>
    /// Notifies clients that a file's tracking status has been updated
    /// </summary>
    public async Task NotifyFileUpdated(ScannedFile file)
    {
        await hubContext.OnFileUpdated(ScannedFileDto.FromScannedFile(file));
    }
} 