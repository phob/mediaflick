using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using PlexLocalScan.Core.Media;
using PlexLocalScan.Core.Tables;
using PlexLocalScan.Data.Data;
using PlexLocalScan.Shared.TmDbMediaSearch.Interfaces;

namespace PlexLocalScan.Shared.TmDbMediaSearch.Services;

/// <summary>
/// Background service that pre-warms the cache with popular/frequently accessed media
/// </summary>
public class CacheWarmingService(
    IServiceScopeFactory serviceScopeFactory,
    ILogger<CacheWarmingService> logger
) : BackgroundService
{
    private readonly TimeSpan _warmingInterval = TimeSpan.FromHours(6); // Run every 6 hours
    private const int MaxItemsToWarm = 50; // Limit to prevent overwhelming the cache

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Cache warming service started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await WarmCache(stoppingToken);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error occurred during cache warming");
            }

            await Task.Delay(_warmingInterval, stoppingToken);
        }

        logger.LogInformation("Cache warming service stopped");
    }

    private async Task WarmCache(CancellationToken cancellationToken)
    {
        using var scope = serviceScopeFactory.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<PlexScanContext>();
        var mediaSearchService = scope.ServiceProvider.GetRequiredService<IMediaSearchService>();

        logger.LogInformation("Starting cache warming process");

        try
        {
            // Get most frequently accessed media (based on scanned files)
            var popularMovies = await GetPopularMovies(dbContext, cancellationToken);
            var popularTvShows = await GetPopularTvShows(dbContext, cancellationToken);

            // Warm movie caches
            await WarmMovieCaches(mediaSearchService, popularMovies, cancellationToken);

            // Warm TV show caches
            await WarmTvShowCaches(mediaSearchService, popularTvShows, cancellationToken);

            logger.LogInformation("Cache warming completed successfully");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error during cache warming process");
        }
    }

    private async Task<List<int>> GetPopularMovies(PlexScanContext dbContext, CancellationToken cancellationToken)
    {
        return await dbContext.ScannedFiles
            .Where(f => f.MediaType == MediaType.Movies && f.TmdbId.HasValue)
            .GroupBy(f => f.TmdbId!.Value)
            .OrderByDescending(g => g.Count()) // Most scanned files = most popular
            .Take(MaxItemsToWarm / 2) // Split between movies and TV shows
            .Select(g => g.Key)
            .ToListAsync(cancellationToken);
    }

    private async Task<List<int>> GetPopularTvShows(PlexScanContext dbContext, CancellationToken cancellationToken)
    {
        return await dbContext.ScannedFiles
            .Where(f => f.MediaType == MediaType.TvShows && f.TmdbId.HasValue)
            .GroupBy(f => f.TmdbId!.Value)
            .OrderByDescending(g => g.Count()) // Most episodes scanned = most popular
            .Take(MaxItemsToWarm / 2) // Split between movies and TV shows
            .Select(g => g.Key)
            .ToListAsync(cancellationToken);
    }

    private async Task WarmMovieCaches(IMediaSearchService mediaSearchService, List<int> movieIds, CancellationToken cancellationToken)
    {
        logger.LogInformation("Warming cache for {Count} popular movies", movieIds.Count);

        var tasks = movieIds.Select(async tmdbId =>
        {
            try
            {
                await mediaSearchService.GetMovieMediaInfoAsync(tmdbId);
                logger.LogDebug("Warmed cache for movie TMDb ID: {TmdbId}", tmdbId);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to warm cache for movie TMDb ID: {TmdbId}", tmdbId);
            }
        });

        await Task.WhenAll(tasks);
    }

    private async Task WarmTvShowCaches(IMediaSearchService mediaSearchService, List<int> tvShowIds, CancellationToken cancellationToken)
    {
        logger.LogInformation("Warming cache for {Count} popular TV shows", tvShowIds.Count);

        var tasks = tvShowIds.Select(async tmdbId =>
        {
            try
            {
                await mediaSearchService.GetTvShowMediaInfoAsync(tmdbId);
                logger.LogDebug("Warmed cache for TV show TMDb ID: {TmdbId}", tmdbId);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to warm cache for TV show TMDb ID: {TmdbId}", tmdbId);
            }
        });

        await Task.WhenAll(tasks);
    }
}
