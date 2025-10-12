# Caching Improvements for Media Lookup API

This document outlines the comprehensive caching improvements implemented to dramatically speed up the movie and TV show info endpoints.

## 🚀 Performance Improvements

### Before vs After
- **Movie Info**: Cache duration increased from 10 seconds → **24 hours**
- **TV Show Info**: Cache duration increased from 10 seconds → **6 hours** 
- **Season Info**: Cache duration increased from 10 seconds → **2 hours**
- **Search Results**: Now cached for **1 hour** (previously uncached)
- **Database Queries**: Optimized with parallel execution and async operations
- **HTTP Caching**: Added proper cache headers for browser/proxy caching

## 🔧 Implementation Details

### 1. Extended Cache Durations
- **Movies**: 24 hours (movie data rarely changes)
- **TV Shows**: 6 hours (episode counts can change more frequently)
- **Seasons**: 2 hours (episode scan status can change)
- **Episodes**: 2 hours (episode data is relatively stable)
- **Search Results**: 1 hour (search results are relatively stable)

### 2. HTTP Response Caching
All endpoints now include proper HTTP cache headers:
- `Cache-Control: public, max-age=X`
- `ETag` headers for conditional requests
- Reduces unnecessary API calls from browsers/proxies

### 3. Database Query Optimization
- **Parallel Execution**: TMDb API calls and database queries run concurrently
- **Async Operations**: All database operations use `CountAsync()` and `ToListAsync()`
- **Efficient Lookups**: HashSet-based episode scanning for O(1) lookups
- **Reduced Round Trips**: Single queries instead of multiple separate calls

### 4. Background Cache Warming
- **CacheWarmingService**: Automatically pre-loads popular media every 6 hours
- **Smart Selection**: Chooses most frequently accessed media (top 50 items)
- **Balanced Warming**: Splits between movies and TV shows evenly
- **Non-blocking**: Runs in background without affecting API performance

### 5. Cache Invalidation System
- **Manual Invalidation**: API endpoints to clear specific cache entries
- **Granular Control**: Separate invalidation for movies, TV shows, seasons, episodes
- **Search Cache Management**: Clear search results when needed
- **Logging**: Comprehensive logging for cache operations

## 🛠️ New API Endpoints

### Cache Management Endpoints
All cache management endpoints are under `/api/medialookup/cache/`:

- `DELETE /api/medialookup/cache/movies/{tmdbId}` - Invalidate movie cache
- `DELETE /api/medialookup/cache/tvshows/{tmdbId}` - Invalidate TV show cache  
- `DELETE /api/medialookup/cache/search?title={title}&mediaType={type}` - Invalidate search cache
- `GET /api/medialookup/cache/stats` - Get cache statistics

### Usage Examples
```bash
# Clear cache for a specific movie
curl -X DELETE "https://yourapi.com/api/medialookup/cache/movies/550"

# Clear cache for a TV show
curl -X DELETE "https://yourapi.com/api/medialookup/cache/tvshows/1399"

# Clear search cache
curl -X DELETE "https://yourapi.com/api/medialookup/cache/search?title=inception&mediaType=Movies"

# Get cache stats
curl "https://yourapi.com/api/medialookup/cache/stats"
```

## 📋 Setup Instructions

### 1. Register Services
Add to your `Program.cs` or startup configuration:

```csharp
using PlexLocalScan.Api.ServiceCollection;

// Add enhanced caching services
builder.Services.AddEnhancedCaching();
```

### 2. Memory Cache Configuration
The system automatically configures memory cache with:
- **Size Limit**: 100MB for media caching
- **Compaction**: Removes 25% of entries when limit reached
- **Automatic Cleanup**: Expired entries are automatically removed

### 3. Background Services
The `CacheWarmingService` automatically starts and:
- Runs every 6 hours
- Warms cache for top 50 most popular media items
- Logs all warming activities

## 🔍 Monitoring & Logging

### Log Messages to Watch For
- `"Returning cached movie search results for: {Title}"` - Cache hit
- `"Fetching movie search results from TMDb for: {Title}"` - Cache miss
- `"Cache warming completed successfully"` - Background warming finished
- `"Cache invalidated for movie TMDb ID: {TmdbId}"` - Manual cache clear

### Performance Metrics
Monitor these improvements:
- **Response Times**: Should be dramatically faster for cached requests
- **TMDb API Calls**: Significant reduction in external API usage
- **Database Load**: Reduced query frequency
- **Memory Usage**: Monitor cache memory consumption

## ⚡ Expected Performance Gains

### First Request (Cache Miss)
- **Before**: ~500-2000ms (TMDb API + DB queries)
- **After**: ~300-800ms (parallel execution optimization)

### Subsequent Requests (Cache Hit)
- **Before**: ~500-2000ms (no caching)
- **After**: ~5-50ms (memory cache retrieval)

### Overall Improvement
- **90-95% reduction** in response time for cached requests
- **60-80% reduction** in TMDb API usage
- **50-70% reduction** in database load
- **Better user experience** with near-instant responses

## 🔧 Maintenance

### When to Invalidate Cache
- After updating media metadata in external systems
- When TMDb data changes (rare)
- After bulk media file operations
- When troubleshooting data inconsistencies

### Monitoring Cache Health
- Check cache hit/miss ratios in logs
- Monitor memory usage trends
- Watch for cache warming service errors
- Verify HTTP cache headers in browser dev tools

## 🚀 Future Enhancements

Consider these additional improvements:
1. **Redis Integration**: For distributed caching across multiple instances
2. **Cache Preloading**: API endpoint to manually warm specific media
3. **Smart Invalidation**: Automatic cache clearing based on file scan events
4. **Metrics Dashboard**: Real-time cache performance monitoring
5. **Conditional Requests**: Full ETag support for even better performance
