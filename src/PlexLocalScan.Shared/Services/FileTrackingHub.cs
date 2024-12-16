using Microsoft.AspNetCore.SignalR;
using PlexLocalScan.Data.Models;
using PlexLocalScan.Shared.Interfaces;
using PlexLocalScan.Shared.Models;

namespace PlexLocalScan.Shared.Services;

/// <summary>
/// SignalR hub for real-time file tracking notifications
/// </summary>
public class FileTrackingHub : Hub<IFileTrackingHub>
{
    private const string HubRoute = "/hubs/filetracking";
    
    /// <summary>
    /// Gets the hub route for client connections
    /// </summary>
    public static string Route => HubRoute;
    
    /// <summary>
    /// Notifies all connected clients about a new file being tracked
    /// </summary>
    public async Task NotifyFileAdded(ScannedFile file)
    {
        await Clients.All.OnFileAdded(ScannedFileDto.FromScannedFile(file));
    }
    
    /// <summary>
    /// Notifies all connected clients about a file being removed from tracking
    /// </summary>
    public async Task NotifyFileRemoved(ScannedFile file)
    {
        await Clients.All.OnFileRemoved(ScannedFileDto.FromScannedFile(file));
    }
    
    /// <summary>
    /// Notifies all connected clients about a file's tracking status being updated
    /// </summary>
    public async Task NotifyFileUpdated(ScannedFile file)
    {
        await Clients.All.OnFileUpdated(ScannedFileDto.FromScannedFile(file));
    }
} 