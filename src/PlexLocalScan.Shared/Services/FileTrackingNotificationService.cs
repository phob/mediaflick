using Microsoft.AspNetCore.SignalR;
using PlexLocalScan.Data.Models;

namespace PlexLocalScan.Shared.Services;

/// <summary>
/// Service for sending file tracking notifications through SignalR
/// </summary>
public class FileTrackingNotificationService
{
    private readonly IHubContext<FileTrackingHub, Interfaces.IFileTrackingHub> _hubContext;

    public FileTrackingNotificationService(IHubContext<FileTrackingHub, Interfaces.IFileTrackingHub> hubContext)
    {
        _hubContext = hubContext;
    }

    /// <summary>
    /// Notifies clients that a file has been added to tracking
    /// </summary>
    public async Task NotifyFileAdded(ScannedFile file)
    {
        await _hubContext.Clients.All.OnFileAdded(file);
    }

    /// <summary>
    /// Notifies clients that a file has been removed from tracking
    /// </summary>
    public async Task NotifyFileRemoved(ScannedFile file)
    {
        await _hubContext.Clients.All.OnFileRemoved(file);
    }

    /// <summary>
    /// Notifies clients that a file's tracking status has been updated
    /// </summary>
    public async Task NotifyFileUpdated(ScannedFile file)
    {
        await _hubContext.Clients.All.OnFileUpdated(file);
    }
} 