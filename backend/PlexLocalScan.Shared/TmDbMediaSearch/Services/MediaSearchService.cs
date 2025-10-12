using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using PlexLocalScan.Core.Media;
using PlexLocalScan.Core.Series;
using PlexLocalScan.Core.Tables;
using PlexLocalScan.Data.Data;
using PlexLocalScan.Shared.TmDbMediaSearch.Interfaces;

namespace PlexLocalScan.Shared.TmDbMediaSearch.Services;

public record MediaSearchResult(int TmdbId, string Title, int? Year, string? PosterPath);

public class MediaSearchService(
    ITmDbClientWrapper tmdbClient,
    ILogger<MediaSearchService> logger,
    PlexScanContext dbContext,
    IMemoryCache cache
) : IMediaSearchService
{
    public async Task<IEnumerable<MediaSearchResult>> SearchMovieTmdbIdsAsync(string title)
    {
        var cacheKey = $"movie_search_{title.ToLowerInvariant()}";
        if (cache.TryGetValue<List<MediaSearchResult>>(cacheKey, out var cachedResults))
        {
            if (cachedResults != null)
            {
                logger.LogInformation("Returning cached movie search results for: {Title}", title);
                return cachedResults;
            }
        }

        logger.LogInformation("Fetching movie search results from TMDb for: {Title}", title);
        var searchResults = await tmdbClient.SearchMovieAsync(title);
        var results = searchResults
            .Results.Select(r => new MediaSearchResult(
                r.Id,
                r.Title,
                r.ReleaseDate?.Year,
                r.PosterPath
            ))
            .ToList();

        // Cache search results for 1 hour - search results are relatively stable
        cache.Set(cacheKey, results, new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(1),
            Size = 1 // Each search result list counts as 1 unit
        });
        return results;
    }

    public async Task<IEnumerable<MediaSearchResult>> SearchTvShowTmdbIdsAsync(string title)
    {
        var cacheKey = $"tvshow_search_{title.ToLowerInvariant()}";
        if (cache.TryGetValue<List<MediaSearchResult>>(cacheKey, out var cachedResults))
        {
            if (cachedResults != null)
            {
                logger.LogInformation("Returning cached TV show search results for: {Title}", title);
                return cachedResults;
            }
        }

        logger.LogInformation("Fetching TV show search results from TMDb for: {Title}", title);
        var searchResults = await tmdbClient.SearchTvShowAsync(title);

        if (searchResults.Results == null)
        {
            logger.LogWarning("SearchTvShowAsync results collection is null");
            return [];
        }

        var results = searchResults
            .Results.Select(r => new MediaSearchResult(
                r.Id,
                r.Name,
                r.FirstAirDate?.Year,
                r.PosterPath
            ))
            .ToList();
        logger.LogInformation("Found {Count} TV show results", results.Count);

        // Cache search results for 1 hour - search results are relatively stable
        cache.Set(cacheKey, results, new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(1),
            Size = 1 // Each search result list counts as 1 unit
        });
        return results;
    }

    public async Task<MediaInfo?> GetMovieMediaInfoAsync(int tmdbId)
    {
        var cacheKey = $"movie_{tmdbId}";
        if (cache.TryGetValue<MediaInfo>(cacheKey, out var cachedInfo))
        {
            return cachedInfo;
        }
        var movie = await tmdbClient.GetMovieAsync(tmdbId);
        var externalIds = await tmdbClient.GetMovieExternalIdsAsync(tmdbId);
        var mediaInfo = new MediaInfo
        {
            Title = movie.Title,
            Year = movie.ReleaseDate?.Year,
            TmdbId = movie.Id,
            ImdbId = externalIds?.ImdbId,
            MediaType = MediaType.Movies,
            PosterPath = movie.PosterPath,
            BackdropPath = movie.BackdropPath,
            Overview = movie.Overview,
            Status = movie.Status,
            Genres = movie.Genres.Select(g => g.Name).ToList().AsReadOnly(),
        };
        // Cache movie info for 24 hours - movie data rarely changes
        cache.Set(cacheKey, mediaInfo, new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(24),
            Size = 2 // Movie info is larger than search results
        });
        return mediaInfo;
    }

    public async Task<MediaInfo?> GetTvShowMediaInfoAsync(int tmdbId, bool includeDetails = false)
    {
        var cacheKey = $"tvshow_{tmdbId}";
        if (cache.TryGetValue<MediaInfo>(cacheKey, out var cachedInfo))
        {
            return cachedInfo;
        }

        // Execute TMDb API calls in parallel to reduce latency
        var tvShowTask = tmdbClient.GetTvShowAsync(tmdbId);
        var externalIdsTask = tmdbClient.GetTvShowExternalIdsAsync(tmdbId);
        
        // Get episodes count from database with a more efficient query
        var episodesScannedFilesTask = dbContext
            .ScannedFiles.Where(f =>
                f.TmdbId == tmdbId
                && f.MediaType == MediaType.TvShows
                && f.Status == FileStatus.Success
            )
            .CountAsync();

        // Await all tasks concurrently
        await Task.WhenAll(tvShowTask, externalIdsTask, episodesScannedFilesTask);
        
        var tvShow = await tvShowTask;
        var externalIds = await externalIdsTask;
        var episodesScannedFiles = await episodesScannedFilesTask;

        var episodeCount = tvShow.NumberOfEpisodes;
        var seasonCount = tvShow.NumberOfSeasons;

        var info = new MediaInfo
        {
            Title = tvShow.Name,
            Year = tvShow.FirstAirDate?.Year,
            TmdbId = tvShow.Id,
            ImdbId = externalIds?.ImdbId,
            Genres = tvShow.Genres.Select(g => g.Name).ToList().AsReadOnly(),
            MediaType = MediaType.TvShows,
            PosterPath = tvShow.PosterPath,
            BackdropPath = tvShow.BackdropPath,
            Overview = tvShow.Overview,
            Status = tvShow.Status,
            EpisodeCount = episodeCount,
            EpisodeCountScanned = episodesScannedFiles,
            SeasonCount = seasonCount,
            SeasonCountScanned = 0,
        };

        // Cache TV show info for 6 hours - episode counts can change more frequently
        cache.Set(cacheKey, info, new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(6),
            Size = 2 // TV show info is similar size to movie info
        });
        return info;
    }

    public async Task<SeasonInfo?> GetTvShowSeasonMediaInfoAsync(
        int tmdbId,
        int seasonNumber,
        bool includeDetails = false
    )
    {
        var cacheKey = $"season_{tmdbId}_{seasonNumber}";
        if (cache.TryGetValue<SeasonInfo>(cacheKey, out var cachedSeason) && cachedSeason != null)
        {
            return cachedSeason;
        }

        // Execute TMDb API call and database queries in parallel
        var seasonTask = tmdbClient.GetTvSeasonAsync(tmdbId, seasonNumber);
        var episodeCountScannedTask = dbContext
            .ScannedFiles.Where(f => f.TmdbId == tmdbId && f.SeasonNumber == seasonNumber)
            .CountAsync();

        // For detailed view, get scanned episodes info
        Task<List<(int EpisodeNumber, int SeasonNumber)>>? episodesScannedFilesTask = null;
        if (includeDetails)
        {
            episodesScannedFilesTask = dbContext
                .ScannedFiles
                .Where(e => e.TmdbId == tmdbId && e.SeasonNumber == seasonNumber)
                .Select(e => new ValueTuple<int, int>(e.EpisodeNumber ?? 0, e.SeasonNumber ?? 0))
                .ToListAsync();
        }

        // Await all tasks
        var season = await seasonTask;
        var episodeCountScanned = await episodeCountScannedTask;
        var episodesScannedFiles = episodesScannedFilesTask != null ? await episodesScannedFilesTask : null;

        var episodes = new List<EpisodeInfo>();
        var episodeCount = season.Episodes.Count;

        if (includeDetails && episodesScannedFiles != null)
        {
            // Create a HashSet for faster lookup performance
            var scannedEpisodeNumbers = new HashSet<int>(
                episodesScannedFiles.Where(e => e.SeasonNumber == seasonNumber)
                                   .Select(e => e.EpisodeNumber)
            );

            episodes.AddRange(
                season.Episodes.Select(episode => new EpisodeInfo
                {
                    EpisodeNumber = episode.EpisodeNumber,
                    Name = episode.Name,
                    Overview = episode.Overview,
                    StillPath = episode.StillPath,
                    AirDate = episode.AirDate,
                    IsScanned = scannedEpisodeNumbers.Contains(episode.EpisodeNumber),
                })
            );
        }

        var seasonInfo = new SeasonInfo
        {
            SeasonNumber = season.SeasonNumber,
            Name = includeDetails ? season.Name : null,
            Overview = includeDetails ? season.Overview : null,
            PosterPath = includeDetails ? season.PosterPath : null,
            AirDate = includeDetails ? season.AirDate : null,
            Episodes = episodes.AsReadOnly(),
            EpisodeCount = episodeCount,
            EpisodeCountScanned = episodeCountScanned,
        };

        // Cache season data for 2 hours - episode scan status can change
        cache.Set(cacheKey, seasonInfo, new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(2),
            Size = 3 // Season info with episodes is larger
        });
        return seasonInfo;
    }

    public async Task<EpisodeInfo?> GetTvShowEpisodeMediaInfoAsync(
        int tmdbId,
        int seasonNumber,
        int episodeNumber,
        bool includeDetails = false
    )
    {
        var cacheKey = $"episode_{tmdbId}_{seasonNumber}_{episodeNumber}";
        if (
            cache.TryGetValue<EpisodeInfo>(cacheKey, out var cachedEpisode)
            && cachedEpisode != null
        )
        {
            return cachedEpisode;
        }
        var episode = await tmdbClient.GetTvEpisodeAsync(tmdbId, seasonNumber, episodeNumber);

        var episodeInfo = new EpisodeInfo { EpisodeNumber = episode.EpisodeNumber };

        if (!includeDetails)
        {
            return episodeInfo;
        }

        episodeInfo.Name = episode.Name;
        episodeInfo.Overview = episode.Overview;
        episodeInfo.StillPath = episode.StillPath;
        episodeInfo.AirDate = episode.AirDate;
        // Cache episode info for 2 hours - episode data is relatively stable
        cache.Set(cacheKey, episodeInfo, new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(2),
            Size = 1 // Episode info is smaller
        });
        return episodeInfo;
    }

    public async Task<string?> GetImageUrlAsync(string path, string size) =>
        await tmdbClient.GetImageUrl(path, size);
}
