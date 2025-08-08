using Microsoft.Extensions.Caching.Memory;
using PlexLocalScan.Shared.TmDbMediaSearch.Services;

namespace PlexLocalScan.Api.ServiceCollection;

/// <summary>
/// Extension methods for configuring caching services
/// </summary>
public static class CachingServiceCollectionExtensions
{
    /// <summary>
    /// Adds enhanced caching services for media lookup
    /// </summary>
    public static IServiceCollection AddEnhancedCaching(this IServiceCollection services)
    {
        // Configure memory cache with size limits for media caching
        services.Configure<MemoryCacheOptions>(options =>
        {
            // Set size limit in cache entry units (not bytes)
            options.SizeLimit = 10000; // Allow up to 10,000 cache entry units
            
            // Enable compaction to automatically remove expired entries
            options.CompactionPercentage = 0.25; // Remove 25% of entries when limit is reached
        });

        // Register cache invalidation service
        services.AddSingleton<ICacheInvalidationService, CacheInvalidationService>();

        // Register cache warming background service
        services.AddHostedService<CacheWarmingService>();

        return services;
    }
}
