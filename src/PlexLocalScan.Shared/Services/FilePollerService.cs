using Hangfire;

using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

using PlexLocalScan.Shared.Configuration.Options;

using System.Collections.Concurrent;

namespace PlexLocalScan.Shared.Services;

public class FilePollerService(
    ILogger<FilePollerService> logger,
    IOptionsMonitor<PlexOptions> options,
    IOptionsMonitor<TmDbOptions> tmDbOptions,
    IServiceScopeFactory serviceScopeFactory,
    IBackgroundJobClient backgroundJobs) : IFilePollerService, IDisposable
{
    private readonly ConcurrentDictionary<string, HashSet<string>> _knownFolders = new();

    public void Initialize()
    {
        logger.LogInformation("FilePollerService initialized");
        foreach (var mapping in options.CurrentValue.FolderMappings)
        {
            logger.LogInformation("Watching folder: {SourceFolder} with Type: {MediaType}",
                mapping.SourceFolder, mapping.MediaType);

            if (Directory.Exists(mapping.SourceFolder))
            {
                _knownFolders[mapping.SourceFolder] = [.. Directory.GetDirectories(mapping.SourceFolder)];
            }
        }
        
        // Schedule the first run
        ScheduleNextRun(TimeSpan.FromSeconds(options.CurrentValue.PollingInterval));
    }

    public async Task ExecutePollingAsync()
    {
        logger.LogDebug("PollingInterval: {PollingInterval}", options.CurrentValue.PollingInterval);
        try
        {
            if (tmDbOptions.CurrentValue.ApiKey == "your-tmdb-api-key")
            {
                logger.LogError("TmDb API key is not set");
                ScheduleNextRun(TimeSpan.FromSeconds(options.CurrentValue.PollingInterval));
                return;
            }

            using var scope = serviceScopeFactory.CreateScope();
            var fileProcessing = scope.ServiceProvider.GetRequiredService<IFileProcessing>();
            await fileProcessing.ProcessAllMappingsAsync(options.CurrentValue, _knownFolders);

            ScheduleNextRun(TimeSpan.FromSeconds(options.CurrentValue.PollingInterval));
        }
        catch (OperationCanceledException)
        {
            logger.LogInformation("FilePollerService job was canceled");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error occurred while monitoring folders");
            ScheduleNextRun(TimeSpan.FromSeconds(5));
        }
    }

    private void ScheduleNextRun(TimeSpan delay)
    {
        try
        {
            backgroundJobs.Schedule(() => ExecutePollingAsync(), delay);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to schedule next run");
        }
    }

    public void Dispose()
    {
        logger.LogInformation("FilePollerService stopping, clearing known folders");
        _knownFolders.Clear();
    }
}

public interface IFilePollerService
{
    void Initialize();
    Task ExecutePollingAsync();
}