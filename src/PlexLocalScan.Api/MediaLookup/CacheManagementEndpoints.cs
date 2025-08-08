using Microsoft.AspNetCore.Http.HttpResults;
using PlexLocalScan.Core.Media;
using PlexLocalScan.Core.Tables;
using PlexLocalScan.Shared.TmDbMediaSearch.Services;

namespace PlexLocalScan.Api.MediaLookup;

/// <summary>
/// Endpoint handlers for cache management functionality
/// </summary>
internal static class CacheManagementEndpoints
{
    /// <summary>
    /// Invalidates cache for a specific movie
    /// </summary>
    internal static Results<Ok, ProblemHttpResult> InvalidateMovieCache(
        int tmdbId,
        ICacheInvalidationService cacheInvalidationService,
        ILogger<Program> logger)
    {
        try
        {
            cacheInvalidationService.InvalidateMovieCache(tmdbId);
            logger.LogInformation("Cache invalidated for movie TMDb ID: {TmdbId}", tmdbId);
            return TypedResults.Ok();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error invalidating cache for movie TMDb ID: {TmdbId}", tmdbId);
            return TypedResults.Problem(
                statusCode: StatusCodes.Status500InternalServerError,
                title: "Cache Invalidation Error",
                detail: "Failed to invalidate movie cache"
            );
        }
    }

    /// <summary>
    /// Invalidates cache for a specific TV show
    /// </summary>
    internal static Results<Ok, ProblemHttpResult> InvalidateTvShowCache(
        int tmdbId,
        ICacheInvalidationService cacheInvalidationService,
        ILogger<Program> logger)
    {
        try
        {
            cacheInvalidationService.InvalidateTvShowCache(tmdbId);
            logger.LogInformation("Cache invalidated for TV show TMDb ID: {TmdbId}", tmdbId);
            return TypedResults.Ok();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error invalidating cache for TV show TMDb ID: {TmdbId}", tmdbId);
            return TypedResults.Problem(
                statusCode: StatusCodes.Status500InternalServerError,
                title: "Cache Invalidation Error",
                detail: "Failed to invalidate TV show cache"
            );
        }
    }

    /// <summary>
    /// Invalidates search cache for a specific title and media type
    /// </summary>
    internal static Results<Ok, ProblemHttpResult> InvalidateSearchCache(
        string title,
        MediaType mediaType,
        ICacheInvalidationService cacheInvalidationService,
        ILogger<Program> logger)
    {
        try
        {
            cacheInvalidationService.InvalidateSearchCache(title, mediaType);
            logger.LogInformation("Search cache invalidated for title: {Title}, type: {MediaType}", title, mediaType);
            return TypedResults.Ok();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error invalidating search cache for title: {Title}, type: {MediaType}", title, mediaType);
            return TypedResults.Problem(
                statusCode: StatusCodes.Status500InternalServerError,
                title: "Cache Invalidation Error",
                detail: "Failed to invalidate search cache"
            );
        }
    }

    /// <summary>
    /// Gets cache statistics (if available)
    /// </summary>
    internal static Ok<object> GetCacheStats(ILogger<Program> logger)
    {
        // For IMemoryCache, detailed stats aren't readily available
        // This is a placeholder for future enhancement with a more feature-rich cache
        logger.LogInformation("Cache statistics requested");
        
        return TypedResults.Ok((object)new
        {
            Message = "Cache statistics not available with current IMemoryCache implementation",
            Recommendation = "Consider implementing Redis or other cache with statistics support for production"
        });
    }
}
