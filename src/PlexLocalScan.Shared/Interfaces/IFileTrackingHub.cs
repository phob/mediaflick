using PlexLocalScan.Data.Models;

namespace PlexLocalScan.Shared.Interfaces;

/// <summary>
/// Interface defining the contract for the FileTracking SignalR hub
/// </summary>
public interface IFileTrackingHub
{
    /// <summary>
    /// Notifies clients when a file has been added to tracking
    /// </summary>
    Task OnFileAdded(ScannedFile file);
    
    /// <summary>
    /// Notifies clients when a file has been removed from tracking
    /// </summary>
    Task OnFileRemoved(ScannedFile file);
    
    /// <summary>
    /// Notifies clients when a file's tracking status has been updated
    /// </summary>
    Task OnFileUpdated(ScannedFile file);
} 