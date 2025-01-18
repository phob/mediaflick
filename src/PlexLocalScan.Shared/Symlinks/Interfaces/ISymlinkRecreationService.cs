using PlexLocalScan.Core.Tables;

namespace PlexLocalScan.Shared.Interfaces;

public interface ISymlinkRecreationService
{
    Task<bool> RecreateSymlinkIfNeededAsync(ScannedFile scannedFile);
    Task<int> RecreateAllSymlinksAsync();
} 