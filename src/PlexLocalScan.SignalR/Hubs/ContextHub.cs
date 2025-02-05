using Microsoft.AspNetCore.SignalR;
using PlexLocalScan.Abstractions;
using PlexLocalScan.Core.Tables;

namespace PlexLocalScan.SignalR.Hubs;

/// <summary>
/// SignalR hub for real-time file tracking notifications
/// </summary>
public class ContextHub : Hub<ISignalRHub>
{
    private const string HubRoute = "/hubs/filetracking";

    /// <summary>
    /// Gets the hub route for client connections
    /// </summary>
    public static string Route => HubRoute;

    public override async Task OnConnectedAsync() => await base.OnConnectedAsync();

    /// <summary>
    /// Notifies all connected clients about a new file being tracked
    /// </summary>
    public async Task OnFileAdded(ScannedFileDto file) => await Clients.All.OnFileAdded(file);

    /// <summary>
    /// Notifies all connected clients about a file being removed from tracking
    /// </summary>
    public async Task OnFileRemoved(ScannedFileDto file) => await Clients.All.OnFileRemoved(file);

    /// <summary>
    /// Notifies all connected clients about a file's tracking status being updated
    /// </summary>
    public async Task OnFileUpdated(ScannedFileDto file) => await Clients.All.OnFileUpdated(file);

    public async Task OnHeartbeat(long timestamp) => await Clients.All.OnHeartbeat(timestamp);
    public async Task OnZurgVersion(long timestamp) => await Clients.All.OnZurgVersion(timestamp);
}
