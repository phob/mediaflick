using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using PlexLocalScan.Data.Data;

namespace PlexLocalScan.Api.ScannedFiles;

/// <summary>
/// Background service that backfills FileSize and FileHash for existing rows
/// where those fields are missing. Runs once on startup.
/// </summary>
public class BackfillMissingFileInfoService(
    ILogger<BackfillMissingFileInfoService> logger,
    IServiceProvider serviceProvider
) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await using var scope = serviceProvider.CreateAsyncScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<PlexScanContext>();

            // Quick existence check to avoid work when nothing to do
            var hasMissing = await dbContext.ScannedFiles
                .AsNoTracking()
                .AnyAsync(
                    f => f.FileSize == null,
                    stoppingToken
                );

            if (!hasMissing)
            {
                logger.LogInformation("Backfill: no files with missing FileSize/FileHash.");
                return;
            }

            logger.LogInformation("Backfill: starting to compute FileSize/FileHash for missing rows.");

            const int batchSize = 200;
            var processed = 0;

            while (!stoppingToken.IsCancellationRequested)
            {
                var batch = await dbContext.ScannedFiles
                    .Where(f => f.FileSize == null)
                    .OrderBy(f => f.Id)
                    .Take(batchSize)
                    .ToListAsync(stoppingToken);

                if (batch.Count == 0)
                {
                    break;
                }

                foreach (var file in batch)
                {
                    if (stoppingToken.IsCancellationRequested)
                    {
                        break;
                    }

                    try
                    {
                        if (string.IsNullOrWhiteSpace(file.SourceFile) || !File.Exists(file.SourceFile))
                        {
                            continue;
                        }

                        // Compute if missing
                        if (file.FileSize == null || file.FileHash == null)
                        {
                            var (size, hash) = GetFileInfo(file.SourceFile);
                            file.FileSize ??= size;
                            file.FileHash ??= hash;
                            file.UpdatedAt = DateTime.UtcNow;
                        }
                    }
                    catch (Exception ex)
                    {
                        logger.LogWarning(ex, "Backfill: failed to compute size/hash for {File}", file.SourceFile);
                    }
                }

                await dbContext.SaveChangesAsync(stoppingToken);
                processed += batch.Count;
                logger.LogInformation("Backfill: processed {Processed} rows so far...", processed);

                // Small delay to avoid DB/file system pressure
                await Task.Delay(TimeSpan.FromMilliseconds(50), stoppingToken);
            }

            logger.LogInformation("Backfill: completed. Processed rows: {Processed}", processed);
        }
        catch (OperationCanceledException)
        {
            // Normal on shutdown
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Backfill: unexpected error while computing FileSize/FileHash");
        }
    }

    private static (long fileSize, string? fileHash) GetFileInfo(string file)
    {
        var fileInfo = new FileInfo(file);
        // Only return size to meet performance constraints on network files
        return (fileInfo.Length, null);
    }
}


