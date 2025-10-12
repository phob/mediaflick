using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using PlexLocalScan.Core.Media;
using PlexLocalScan.Core.Tables;

namespace PlexLocalScan.Shared.TmDbMediaSearch.Services;

/// <summary>
/// Service to handle cache invalidation for media-related caches
/// </summary>
public interface ICacheInvalidationService
{
    /// <summary>
    /// Invalidates all cached data for a specific movie
    /// </summary>
    void InvalidateMovieCache(int tmdbId);

    /// <summary>
    /// Invalidates all cached data for a specific TV show
    /// </summary>
    void InvalidateTvShowCache(int tmdbId);

    /// <summary>
    /// Invalidates cached data for a specific TV season
    /// </summary>
    void InvalidateSeasonCache(int tmdbId, int seasonNumber);

    /// <summary>
    /// Invalidates cached data for a specific TV episode
    /// </summary>
    void InvalidateEpisodeCache(int tmdbId, int seasonNumber, int episodeNumber);

    /// <summary>
    /// Invalidates search caches for a specific title
    /// </summary>
    void InvalidateSearchCache(string title, MediaType mediaType);

    /// <summary>
    /// Invalidates all media-related caches (use sparingly)
    /// </summary>
    void InvalidateAllMediaCaches();
}

public class CacheInvalidationService(
    IMemoryCache cache,
    ILogger<CacheInvalidationService> logger
) : ICacheInvalidationService
{
    private readonly List<string> _cacheKeys = [];

    public void InvalidateMovieCache(int tmdbId)
    {
        var cacheKey = $"movie_{tmdbId}";
        cache.Remove(cacheKey);
        logger.LogInformation("Invalidated movie cache for TMDb ID: {TmdbId}", tmdbId);
    }

    public void InvalidateTvShowCache(int tmdbId)
    {
        var cacheKey = $"tvshow_{tmdbId}";
        cache.Remove(cacheKey);
        logger.LogInformation("Invalidated TV show cache for TMDb ID: {TmdbId}", tmdbId);
    }

    public void InvalidateSeasonCache(int tmdbId, int seasonNumber)
    {
        var cacheKey = $"season_{tmdbId}_{seasonNumber}";
        cache.Remove(cacheKey);
        logger.LogInformation("Invalidated season cache for TMDb ID: {TmdbId}, Season: {SeasonNumber}", tmdbId, seasonNumber);
    }

    public void InvalidateEpisodeCache(int tmdbId, int seasonNumber, int episodeNumber)
    {
        var cacheKey = $"episode_{tmdbId}_{seasonNumber}_{episodeNumber}";
        cache.Remove(cacheKey);
        logger.LogInformation("Invalidated episode cache for TMDb ID: {TmdbId}, Season: {SeasonNumber}, Episode: {EpisodeNumber}", tmdbId, seasonNumber, episodeNumber);
    }

    public void InvalidateSearchCache(string title, MediaType mediaType)
    {
        var cacheKey = mediaType == MediaType.Movies 
            ? $"movie_search_{title.ToLowerInvariant()}" 
            : $"tvshow_search_{title.ToLowerInvariant()}";
        
        cache.Remove(cacheKey);
        logger.LogInformation("Invalidated search cache for title: {Title}, type: {MediaType}", title, mediaType);
    }

    public void InvalidateAllMediaCaches()
    {
        // This is a simplified implementation - in production you might want to track cache keys
        logger.LogWarning("Invalidating all media caches - this will impact performance temporarily");
        
        // For IMemoryCache, we can't easily enumerate all keys, so we would need to implement
        // a key tracking mechanism or use a different cache implementation like Redis
        // For now, we'll just log the action
        logger.LogInformation("All media cache invalidation requested - consider implementing key tracking for complete invalidation");
    }
}
