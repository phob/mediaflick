using Microsoft.AspNetCore.SignalR;
using PlexLocalScan.Data.Models;
using PlexLocalScan.Shared.Interfaces;
using PlexLocalScan.Shared.Models;

namespace PlexLocalScan.Api.Hubs;

/// <summary>
/// SignalR hub for real-time file tracking notifications
/// </summary>
public class FileTrackingHub : Hub, IFileTrackingHub
{
    private const string HubRoute = "/hubs/filetracking";
    private readonly System.Timers.Timer _heartbeatTimer;
    private bool _disposed;
    
    public FileTrackingHub()
    {
        _heartbeatTimer = new System.Timers.Timer(30000); // 30 second interval
        _heartbeatTimer.Elapsed += async (s, e) => await SendHeartbeat();
        _heartbeatTimer.AutoReset = true;
        _heartbeatTimer.Start();
    }

    /// <summary>
    /// Gets the hub route for client connections
    /// </summary>
    public static string Route => HubRoute;

    public override async Task OnConnectedAsync()
    {
        await SendHeartbeat();
        await base.OnConnectedAsync();
    }
    
    public async Task SendHeartbeat()
    {
        try 
        {
            var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            await Clients.All.SendAsync(nameof(IFileTrackingHub.OnHeartbeat), timestamp);
        }
        catch
        {
            // Ignore any errors during heartbeat
        }
    }
    
    /// <summary>
    /// Notifies all connected clients about a new file being tracked
    /// </summary>
    public async Task OnFileAdded(ScannedFileDto file)
    {
        await Clients.All.SendAsync(nameof(IFileTrackingHub.OnFileAdded), file);
    }
    
    /// <summary>
    /// Notifies all connected clients about a file being removed from tracking
    /// </summary>
    public async Task OnFileRemoved(ScannedFileDto file)
    {
        await Clients.All.SendAsync(nameof(IFileTrackingHub.OnFileRemoved), file);
    }
    
    /// <summary>
    /// Notifies all connected clients about a file's tracking status being updated
    /// </summary>
    public async Task OnFileUpdated(ScannedFileDto file)
    {
        await Clients.All.SendAsync(nameof(IFileTrackingHub.OnFileUpdated), file);
    }

    public async Task OnHeartbeat(long timestamp)
    {
        await Clients.All.SendAsync(nameof(IFileTrackingHub.OnHeartbeat), timestamp);
    }

    protected override void Dispose(bool disposing)
    {
        if (!_disposed)
        {
            if (disposing)
            {
                _heartbeatTimer?.Dispose();
            }
            _disposed = true;
        }
    }

    public new void Dispose()
    {
        Dispose(true);
        GC.SuppressFinalize(this);
    }
} 