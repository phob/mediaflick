using PlexLocalScan.SignalR.Services;

namespace PlexLocalScan.Api.ServiceCollection;

public static class SignalR
{
    public static void AddSignalRService(this IServiceCollection services)
    {
        // Add SignalR
        services.AddSignalR();
    }
}
