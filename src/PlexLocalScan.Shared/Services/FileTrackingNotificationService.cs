using Microsoft.AspNetCore.SignalR;
using PlexLocalScan.Data.Models;
using PlexLocalScan.Shared.Models;
namespace PlexLocalScan.Shared.Services;

/// <summary>
/// Service for sending file tracking notifications through SignalR
/// </summary>
public class FileTrackingNotificationService(IHubContext<FileTrackingHub, Interfaces.IFileTrackingHub> hubContext)
{
    /// <summary>
    /// Notifies clients that a file has been added to tracking
    /// </summary>
    public async Task NotifyFileAdded(ScannedFile file)
    {
        await hubContext.Clients.All.OnFileAdded(ScannedFileDto.FromScannedFile(file));
    }

    /// <summary>
    /// Notifies clients that a file has been removed from tracking
    /// </summary>
    public async Task NotifyFileRemoved(ScannedFile file)
    {
        await hubContext.Clients.All.OnFileRemoved(ScannedFileDto.FromScannedFile(file));
    }

    /// <summary>
    /// Notifies clients that a file's tracking status has been updated
    /// </summary>
    public async Task NotifyFileUpdated(ScannedFile file)
    {
        await hubContext.Clients.All.OnFileUpdated(ScannedFileDto.FromScannedFile(file));
    }
} 