using PlexLocalScan.Data.Models;

namespace PlexLocalScan.Shared.Interfaces;

public interface ISymlinkRecreationService
{
    Task<bool> RecreateSymlinkIfNeededAsync(ScannedFile scannedFile);
} 