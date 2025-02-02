using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Hosting;
using PlexLocalScan.Abstractions;
using PlexLocalScan.SignalR.Hubs;

namespace PlexLocalScan.SignalR.Services;

public class HeartbeatService : IHostedService, IDisposable
{
    private readonly IHubContext<ContextHub, ISignalRHub> _hubContext;
    private readonly Timer _timer;
    private bool _disposed;

    public HeartbeatService(IHubContext<ContextHub, ISignalRHub> hubContext)
    {
        _hubContext = hubContext;
        _timer = new Timer(SendHeartbeat, null, TimeSpan.Zero, TimeSpan.FromSeconds(30));
    }

    public Task StartAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    public Task StopAsync(CancellationToken cancellationToken)
    {
        _timer?.Change(Timeout.Infinite, 0);
        return Task.CompletedTask;
    }

    private async void SendHeartbeat(object? state)
    {
        try
        {
            var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            await _hubContext.Clients.All.OnHeartbeat(timestamp);
        }
        catch
        {
            // Ignore any errors during heartbeat
        }
    }

    protected virtual void Dispose(bool disposing)
    {
        if (!_disposed)
        {
            if (disposing)
            {
                _timer?.Dispose();
            }
            _disposed = true;
        }
    }

    public void Dispose()
    {
        Dispose(true);
        GC.SuppressFinalize(this);
    }
}
