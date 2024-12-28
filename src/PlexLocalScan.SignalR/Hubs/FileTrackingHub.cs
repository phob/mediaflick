using Microsoft.AspNetCore.SignalR;
using PlexLocalScan.Core.Tables;
using PlexLocalScan.SignalR.Services;

namespace PlexLocalScan.SignalR.Hubs;

/// <summary>
/// SignalR hub for real-time file tracking notifications
/// </summary>
public class FileTrackingHub : Hub<ISignalRHub>
{
    private const string HubRoute = "/hubs/filetracking";
    private readonly System.Timers.Timer _heartbeatTimer;
    private bool _disposed;
    
    public FileTrackingHub()
    {
        _heartbeatTimer = new System.Timers.Timer(30000); // 30 second interval
        _heartbeatTimer.Elapsed += async (_, _) => await SendHeartbeat();
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
            await Clients.All.OnHeartbeat(timestamp);
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
        await Clients.All.OnFileAdded(file);
    }
    
    /// <summary>
    /// Notifies all connected clients about a file being removed from tracking
    /// </summary>
    public async Task OnFileRemoved(ScannedFileDto file)
    {
        await Clients.All.OnFileRemoved(file);
    }
    
    /// <summary>
    /// Notifies all connected clients about a file's tracking status being updated
    /// </summary>
    public async Task OnFileUpdated(ScannedFileDto file)
    {
        await Clients.All.OnFileUpdated(file);
    }

    public async Task OnHeartbeat(long timestamp)
    {
        await Clients.All.OnHeartbeat(timestamp);
    }


    protected override void Dispose(bool disposing)
    {
        if (!_disposed)
        {
            if (disposing)
            {
                _heartbeatTimer.Dispose();
            }
            _disposed = true;
        }
        base.Dispose(disposing);
    }
} 