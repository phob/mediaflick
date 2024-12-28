using Microsoft.AspNetCore.SignalR;
using PlexLocalScan.Core.Tables;
using PlexLocalScan.FileTracking.Hubs;
using PlexLocalScan.FileTracking.Interfaces;
using PlexLocalScan.Shared.Models;

namespace PlexLocalScan.FileTracking.Services;

/// <summary>
/// Service for sending file tracking notifications through SignalR
/// </summary>
public class NotificationService(IHubContext<FileTrackingHub, ISignalRHub> hubContext)
    : INotificationService
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