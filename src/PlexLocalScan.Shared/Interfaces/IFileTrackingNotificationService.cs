using PlexLocalScan.Data.Models;

namespace PlexLocalScan.Shared.Services;

public interface IFileTrackingNotificationService
{
    /// <summary>
    /// Notifies clients that a file has been added to tracking
    /// </summary>
    Task NotifyFileAdded(ScannedFile file);

    /// <summary>
    /// Notifies clients that a file has been removed from tracking
    /// </summary>
    Task NotifyFileRemoved(ScannedFile file);

    /// <summary>
    /// Notifies clients that a file's tracking status has been updated
    /// </summary>
    Task NotifyFileUpdated(ScannedFile file);
}