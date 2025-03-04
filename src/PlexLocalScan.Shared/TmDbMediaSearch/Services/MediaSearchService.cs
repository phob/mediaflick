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
        var searchResults = await tmdbClient.SearchMovieAsync(title);
        return searchResults
            .Results.Select(r => new MediaSearchResult(
                r.Id,
                r.Title,
                r.ReleaseDate?.Year,
                r.PosterPath
            ))
            .ToList();
    }

    public async Task<IEnumerable<MediaSearchResult>> SearchTvShowTmdbIdsAsync(string title)
    {
        logger.LogInformation("Searching for TV show with title: {Title}", title);
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
        cache.Set(cacheKey, mediaInfo, TimeSpan.FromSeconds(10));
        return mediaInfo;
    }

    public async Task<MediaInfo?> GetTvShowMediaInfoAsync(int tmdbId, bool includeDetails = false)
    {
        var cacheKey = $"tvshow_{tmdbId}";
        if (cache.TryGetValue<MediaInfo>(cacheKey, out var cachedInfo))
        {
            return cachedInfo;
        }

        var tvShow = await tmdbClient.GetTvShowAsync(tmdbId);
        var externalIds = await tmdbClient.GetTvShowExternalIdsAsync(tmdbId);
        // Get episodes and seasons from database
        var episodesScannedFiles = dbContext
            .ScannedFiles.Where(f =>
                f.TmdbId == tmdbId
                && f.MediaType == MediaType.TvShows
                && f.Status == FileStatus.Success
            )
            .Count();

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

        cache.Set(cacheKey, info, TimeSpan.FromSeconds(10));
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

        var season = await tmdbClient.GetTvSeasonAsync(tmdbId, seasonNumber);
        var episodes = new List<EpisodeInfo>();
        var episodeCount = season.Episodes.Count;
        var episodeCountScanned = dbContext
            .ScannedFiles.Where(f => f.TmdbId == tmdbId && f.SeasonNumber == seasonNumber)
            .Count();

        if (includeDetails)
        {
            var episodesScannedFiles = dbContext
                .ScannedFiles.Select(e => new
                {
                    e.TmdbId,
                    e.SeasonNumber,
                    e.EpisodeNumber,
                })
                .Where(e => e.TmdbId == tmdbId && e.SeasonNumber == seasonNumber)
                .ToList();
            episodes.AddRange(
                season.Episodes.Select(episode => new EpisodeInfo
                {
                    EpisodeNumber = episode.EpisodeNumber,
                    Name = episode.Name,
                    Overview = episode.Overview,
                    StillPath = episode.StillPath,
                    AirDate = episode.AirDate,
                    IsScanned = episodesScannedFiles.Any(e =>
                        e.EpisodeNumber == episode.EpisodeNumber && e.SeasonNumber == seasonNumber
                    ),
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

        // Cache the season data
        cache.Set(cacheKey, seasonInfo, TimeSpan.FromSeconds(10));
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
        cache.Set(cacheKey, episodeInfo, TimeSpan.FromMinutes(10));
        return episodeInfo;
    }

    public async Task<string?> GetImageUrlAsync(string path, string size) =>
        await tmdbClient.GetImageUrl(path, size);
}
