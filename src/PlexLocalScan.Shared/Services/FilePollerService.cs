using System.Collections.Concurrent;
using Coravel.Invocable;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PlexLocalScan.Shared.Configuration.Options;

namespace PlexLocalScan.Shared.Services;

public class FilePollerService(
    ILogger<FilePollerService> logger,
    IOptionsMonitor<PlexOptions> options,
    IOptionsMonitor<TmDbOptions> tmDbOptions,
    IFileProcessing fileProcessing
) : IInvocable
{
    private readonly ConcurrentDictionary<string, HashSet<string>> _knownFolders = [];

    public async Task Invoke() => await ExecutePollingAsync();

    public async Task ExecutePollingAsync()
    {
        try
        {
            await InitializeFoldersAsync();
            await ProcessFilesAsync();
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
