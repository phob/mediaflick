using Coravel.Invocable;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Logging;
using PlexLocalScan.Abstractions;
using PlexLocalScan.SignalR.Hubs;

namespace PlexLocalScan.SignalR.Services;

public class HeartbeatService(
    IHubContext<ContextHub, ISignalRHub> hubContext,
    ILogger<HeartbeatService> logger
) : IInvocable
{
    public async Task Invoke()
    {
        try
        {
            logger.LogDebug("Starting heartbeat service execution");
            var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            var connectionCount = hubContext.Clients.All.GetType().ToString();
            logger.LogDebug(
                "Sending heartbeat to {ConnectionCount} at {Timestamp}",
                connectionCount,
                timestamp
            );
            await hubContext.Clients.All.OnHeartbeat(timestamp);
            logger.LogDebug("Heartbeat sent successfully");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error occurred while sending heartbeat");
        }
    }
}
