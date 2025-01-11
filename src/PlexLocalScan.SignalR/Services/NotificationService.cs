using Microsoft.AspNetCore.SignalR;
using PlexLocalScan.Abstractions;
using PlexLocalScan.Core.Tables;
using PlexLocalScan.SignalR.Hubs;

namespace PlexLocalScan.SignalR.Services;

/// <summary>
/// Service for sending file tracking notifications through SignalR
/// </summary>
public class NotificationService(IHubContext<ContextHub, ISignalRHub> hubContext)
    : INotificationService
{
    public async Task NotifyFileAdded(ScannedFile file) => await hubContext.Clients.All.OnFileAdded(ScannedFileDto.FromScannedFile(file));

    public async Task NotifyFileRemoved(ScannedFile file) => await hubContext.Clients.All.OnFileRemoved(ScannedFileDto.FromScannedFile(file));

    public async Task NotifyFileUpdated(ScannedFile file) => await hubContext.Clients.All.OnFileUpdated(ScannedFileDto.FromScannedFile(file));

} 
