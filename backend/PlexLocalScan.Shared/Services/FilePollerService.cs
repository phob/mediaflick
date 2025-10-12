using System.Collections.Concurrent;
using Coravel.Invocable;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PlexLocalScan.Shared.Configuration.Options;
using PlexLocalScan.Shared.Plex.Interfaces;

namespace PlexLocalScan.Shared.Services;

public class FilePollerService(
    ILogger<FilePollerService> logger,
    IOptionsMonitor<PlexOptions> options,
    IOptionsMonitor<TmDbOptions> tmDbOptions,
    IOptionsMonitor<ZurgOptions> zurgOptions,
    IFileProcessing fileProcessing,
    IPlexHandler plexHandler
) : IInvocable
{
    private readonly ConcurrentDictionary<string, HashSet<string>> _knownFolders = [];

    public async Task Invoke() => await ExecutePollingAsync();

    public async Task ExecutePollingAsync()
    {
        try
        {
            if (File.Exists(zurgOptions.CurrentValue.VersionLocation))
            {
                var prepare = PlexPrepare.SnapshotBefore(options.CurrentValue.FolderMappings);
                await InitializeFoldersAsync();
                await ProcessFilesAsync();
                var after = PlexPrepare.SnapshotAfter(options.CurrentValue.FolderMappings, prepare);

                foreach (var change in after)
                {
                    await plexHandler.UpdateFolderForScanningAsync(change.Key, change.Value);
                }
            }
            else
            {
                logger.LogInformation("Zurg version file not found");
            }
        }
        catch (OperationCanceledException)
        {
            logger.LogInformation("File polling operation canceled");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error in file polling operation");
        }
    }

    private async Task ProcessFilesAsync()
    {
        if (tmDbOptions.CurrentValue.ApiKey == "your-tmdb-api-key")
        {
            logger.LogError("TmDb API key not configured");
            return;
        }

        await fileProcessing.ProcessAllMappingsAsync(options.CurrentValue, _knownFolders);
    }

    private Task InitializeFoldersAsync()
    {
        foreach (var mapping in options.CurrentValue.FolderMappings)
        {
            if (Directory.Exists(mapping.SourceFolder))
            {
                _knownFolders[mapping.SourceFolder] =
                [
                    .. Directory.GetDirectories(mapping.SourceFolder),
                ];
            }
        }

        return Task.CompletedTask;
    }
}
