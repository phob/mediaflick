using PlexLocalScan.Core.Tables;

namespace PlexLocalScan.Abstractions;

/// <summary>
/// Interface defining the contract for the FileTracking SignalR hub
/// </summary>
public interface ISignalRHub
{
    /// <summary>
    /// Notifies clients when a file has been added to tracking
    /// </summary>
    Task OnFileAdded(ScannedFileDto file);

    /// <summary>
    /// Notifies clients when a file has been removed from tracking
    /// </summary>
    Task OnFileRemoved(ScannedFileDto file);

    /// <summary>
    /// Notifies clients when a file's tracking status has been updated
    /// </summary>
    Task OnFileUpdated(ScannedFileDto file);

    /// <summary>
    /// Sends server timestamp to clients for heartbeat
    /// </summary>
    Task OnHeartbeat(long timestamp);

    /// <summary>
    /// Sends Zurg version to clients
    /// </summary>
    Task OnZurgVersion(long timestamp);
}
