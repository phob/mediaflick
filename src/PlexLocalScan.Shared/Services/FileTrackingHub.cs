using Microsoft.AspNetCore.SignalR;
using PlexLocalScan.Data.Models;
using PlexLocalScan.Shared.Interfaces;
using PlexLocalScan.Shared.Models;

namespace PlexLocalScan.Shared.Services;

/// <summary>
/// SignalR hub for real-time file tracking notifications
/// </summary>
public class FileTrackingHub : Hub<IFileTrackingHub>, IDisposable
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
    
    private async Task SendHeartbeat()
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