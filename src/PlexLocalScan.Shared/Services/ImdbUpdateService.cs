using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
using PlexLocalScan.Data.Data;
using PlexLocalScan.Data.Models;
using PlexLocalScan.Shared.Interfaces;

namespace PlexLocalScan.Shared.Services;

public class ImdbUpdateService(
    ILogger<ImdbUpdateService> logger,
    ITMDbClientWrapper tmdbClient,
    PlexScanContext dbContext)
    : IImdbUpdateService
{
    public async Task<(int updated, int failed)> UpdateMissingImdbIdsAsync(int batchSize = 50)
    {
        var updated = 0;
        var failed = 0;

        try
        {
            // Get all entries with TMDb ID but no IMDb ID
            var entries = await dbContext.ScannedFiles
                .Where(f => f.TmdbId != null && string.IsNullOrEmpty(f.ImdbId))
                .ToListAsync();

            logger.LogInformation("Found {Count} entries missing IMDb IDs", entries.Count);

            // Process in batches to avoid overwhelming the TMDb API
            foreach (var batch in entries.Chunk(batchSize))
            {
                foreach (var entry in batch)
                {
                    try
                    {
                        string? imdbId = null;
                        
                        // Get external IDs based on media type
                        if (entry.MediaType == MediaType.Movies)
                        {
                            var movieExternalIds = await tmdbClient.GetMovieExternalIdsAsync(entry.TmdbId!.Value);
                            imdbId = movieExternalIds.ImdbId;
                        }
                        else if (entry.MediaType == MediaType.TvShows)
                        {
                            var tvExternalIds = await tmdbClient.GetTvShowExternalIdsAsync(entry.TmdbId!.Value);
                            imdbId = tvExternalIds.ImdbId;
                        }

                        if (!string.IsNullOrEmpty(imdbId))
                        {
                            entry.ImdbId = imdbId;
                            updated++;
                            logger.LogInformation("Updated IMDb ID for TMDb ID {TmdbId}: {ImdbId}", entry.TmdbId, imdbId);
                        }
                        else
                        {
                            failed++;
                            logger.LogWarning("No IMDb ID found for TMDb ID {TmdbId}", entry.TmdbId);
                        }
                    }
                    catch (Exception ex)
                    {
                        failed++;
                        logger.LogError(ex, "Error updating IMDb ID for TMDb ID {TmdbId}", entry.TmdbId);
                    }
                }

                // Save changes after each batch
                await dbContext.SaveChangesAsync();
                
                // Add a small delay to avoid rate limiting
                await Task.Delay(1000);
            }

            logger.LogInformation("IMDb ID update completed. Updated: {Updated}, Failed: {Failed}", updated, failed);
            return (updated, failed);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error during IMDb ID update process");
            throw;
        }
    }
} 