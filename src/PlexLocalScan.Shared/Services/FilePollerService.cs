using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PlexLocalScan.Shared.Configuration.Options;
using System.Collections.Concurrent;

namespace PlexLocalScan.Shared.Services;

public class FilePollerService(
    ILogger<FilePollerService> logger,
    IOptionsMonitor<PlexOptions> options,
    IOptionsMonitor<TmDbOptions> tmDbOptions,
    IServiceScopeFactory serviceScopeFactory) : BackgroundService
{
    private readonly ConcurrentDictionary<string, HashSet<string>> _knownFolders = new();

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("FilePollerService started");
        // Initialize known folders dictionary
        foreach (var mapping in options.CurrentValue.FolderMappings)
        {
            logger.LogInformation("Watching folder: {SourceFolder} with Type: {MediaType}", mapping.SourceFolder, mapping.MediaType);
            if (Directory.Exists(mapping.SourceFolder))
            {
                _knownFolders[mapping.SourceFolder] = [.. Directory.GetDirectories(mapping.SourceFolder)];
            }
        }
        while (!stoppingToken.IsCancellationRequested)
        {
            logger.LogInformation("PollingInterval: {PollingInterval}", options.CurrentValue.PollingInterval);
            try
            {
                if (tmDbOptions.CurrentValue.ApiKey == "your-tmdb-api-key")
                {
                    logger.LogError("TmDb API key is not set");
                    await Task.Delay(TimeSpan.FromSeconds(options.CurrentValue.PollingInterval), stoppingToken);
                    continue;
                }
                using var scope = serviceScopeFactory.CreateScope();
                var fileProcessing = scope.ServiceProvider.GetRequiredService<IFileProcessing>();
                await fileProcessing.ProcessAllMappingsAsync(options.CurrentValue, _knownFolders);
                await Task.Delay(TimeSpan.FromSeconds(options.CurrentValue.PollingInterval), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                // Graceful shutdown, no need to log an error
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error occurred while monitoring folders");
                try
                {
                    await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    // Graceful shutdown during error recovery
                    break;
                }
            }
        }

        logger.LogInformation("FilePollerService shutting down");
    }

    public override Task StopAsync(CancellationToken cancellationToken)
    {
        logger.LogInformation("FilePollerService stopping, clearing known folders");
        _knownFolders.Clear();
        return base.StopAsync(cancellationToken);
    }
}
