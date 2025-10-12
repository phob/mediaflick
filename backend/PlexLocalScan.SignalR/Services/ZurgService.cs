using Coravel.Invocable;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Options;
using PlexLocalScan.Abstractions;
using PlexLocalScan.Shared.Configuration.Options;
using PlexLocalScan.SignalR.Hubs;

namespace PlexLocalScan.SignalR.Services;

public class ZurgService(
    IHubContext<ContextHub, ISignalRHub> hubContext,
    IOptions<ZurgOptions> zurgOptions
) : IInvocable
{
    public async Task Invoke()
    {
        try
        {
            if (File.Exists(zurgOptions.Value.VersionLocation))
            {
                var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
                await hubContext.Clients.All.OnZurgVersion(timestamp);
            }

        }
        catch
        {
            // Ignore any errors during heartbeat
        }
    }
}
