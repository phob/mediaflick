using PlexLocalScan.Shared.Interfaces;
using Microsoft.Extensions.Logging;
using PlexLocalScan.Core.Media;
using PlexLocalScan.Core.Series;
using PlexLocalScan.Core.Tables;
using PlexLocalScan.Data.Data;
using Microsoft.Extensions.Caching.Memory;

namespace PlexLocalScan.Shared.Services;

public record MediaSearchResult(int TmdbId, string Title, int? Year, string? PosterPath);

public class MediaSearchService(ITmDbClientWrapper tmdbClient, ILogger<MediaSearchService> logger, PlexScanContext dbContext, IMemoryCache cache) : IMediaSearchService
{
    public async Task<IEnumerable<MediaSearchResult>> SearchMovieTmdbIdsAsync(string title)
    {
        TMDbLib.Objects.General.SearchContainer<TMDbLib.Objects.Search.SearchMovie> searchResults = await tmdbClient.SearchMovieAsync(title);
        return searchResults.Results.Select(r => new MediaSearchResult(r.Id, r.Title, r.ReleaseDate?.Year, r.PosterPath)).ToList();
    }

    public async Task<IEnumerable<MediaSearchResult>> SearchTvShowTmdbIdsAsync(string title)
    {
        logger.LogInformation("Searching for TV show with title: {Title}", title);
        TMDbLib.Objects.General.SearchContainer<TMDbLib.Objects.Search.SearchTv> searchResults = await tmdbClient.SearchTvShowAsync(title);

        if (searchResults.Results == null)
        {
            logger.LogWarning("SearchTvShowAsync results collection is null");
            return [];
        }

        var results = searchResults.Results.Select(r => new MediaSearchResult(r.Id, r.Name, r.FirstAirDate?.Year, r.PosterPath)).ToList();
        logger.LogInformation("Found {Count} TV show results", results.Count);
        
        return results;
    }

    public async Task<MediaInfo?> GetMovieMediaInfoAsync(int tmdbId)
    {
        string cacheKey = $"movie_{tmdbId}";
        if (cache.TryGetValue<MediaInfo>(cacheKey, out MediaInfo? cachedInfo))
        {
            return cachedInfo;
        }
        TMDbLib.Objects.Movies.Movie movie = await tmdbClient.GetMovieAsync(tmdbId);
        TMDbLib.Objects.General.ExternalIdsMovie externalIds = await tmdbClient.GetMovieExternalIdsAsync(tmdbId);
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
            Genres = movie.Genres.Select(g => g.Name).ToList().AsReadOnly()
        };
        cache.Set(cacheKey, mediaInfo, TimeSpan.FromMinutes(60));
        return mediaInfo;
    }

    public async Task<MediaInfo?> GetTvShowMediaInfoAsync(int tmdbId, bool includeDetails = false)
    {
        string cacheKey = $"tvshow_{tmdbId}";
        if (cache.TryGetValue<MediaInfo>(cacheKey, out MediaInfo? cachedInfo))
        {
            return cachedInfo;
        }
            
        TMDbLib.Objects.TvShows.TvShow tvShow = await tmdbClient.GetTvShowAsync(tmdbId);
        TMDbLib.Objects.General.ExternalIdsTvShow externalIds = await tmdbClient.GetTvShowExternalIdsAsync(tmdbId);
        // Get episodes and seasons from database
        int episodesScannedFiles = dbContext.ScannedFiles
            .Where(f => f.TmdbId == tmdbId 
                        && f.MediaType == MediaType.TvShows
                        && f.Status == FileStatus.Success)
            .OrderBy(e => e.SeasonNumber)
            .Count();

        int episodeCount = tvShow.NumberOfEpisodes;
        int seasonCount = tvShow.NumberOfSeasons;

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
            SeasonCountScanned = 0
        };

        cache.Set(cacheKey, info, TimeSpan.FromMinutes(10));
        return info;
        
    }

    public async Task<SeasonInfo?> GetTvShowSeasonMediaInfoAsync(int tmdbId, int seasonNumber, bool includeDetails = false)
    {
        string cacheKey = $"season_{tmdbId}_{seasonNumber}";
        if (cache.TryGetValue<SeasonInfo>(cacheKey, out SeasonInfo? cachedSeason) && cachedSeason != null)
        {
            return cachedSeason;
        }

        TMDbLib.Objects.TvShows.TvSeason season = await tmdbClient.GetTvSeasonAsync(tmdbId, seasonNumber);
        var episodes = new List<EpisodeInfo>();
        if (includeDetails)
        {
            var episodesScannedFiles = dbContext.ScannedFiles
                .Select(e => new { e.TmdbId, e.SeasonNumber, e.EpisodeNumber })
                .Where(e => e.TmdbId == tmdbId && e.SeasonNumber == seasonNumber)
                .ToList();
            episodes.AddRange(season.Episodes.Select(episode => new EpisodeInfo
            {
                EpisodeNumber = episode.EpisodeNumber,
                Name = includeDetails ? episode.Name : null,
                Overview = includeDetails ? episode.Overview : null,
                StillPath = includeDetails ? episode.StillPath : null,
                AirDate = includeDetails ? episode.AirDate : null,
                IsScanned = episodesScannedFiles.Any(e => e.EpisodeNumber == episode.EpisodeNumber 
                                                          && e.SeasonNumber == seasonNumber)
            }));
        }

        var seasonInfo = new SeasonInfo
        {
            SeasonNumber = season.SeasonNumber,
            Name = includeDetails ? season.Name : null,
            Overview = includeDetails ? season.Overview : null,
            PosterPath = includeDetails ? season.PosterPath : null,
            AirDate = includeDetails ? season.AirDate : null,
            Episodes = episodes.AsReadOnly()
        };

        // Cache the season data
        cache.Set(cacheKey, seasonInfo, TimeSpan.FromMinutes(10));
        return seasonInfo;
    }

    public async Task<EpisodeInfo?> GetTvShowEpisodeMediaInfoAsync(int tmdbId, int seasonNumber, int episodeNumber, bool includeDetails = false)
    {
        string cacheKey = $"episode_{tmdbId}_{seasonNumber}_{episodeNumber}";
        if (cache.TryGetValue<EpisodeInfo>(cacheKey, out EpisodeInfo? cachedEpisode) && cachedEpisode != null)
        {
            return cachedEpisode;
        }
        TMDbLib.Objects.TvShows.TvEpisode episode = await tmdbClient.GetTvEpisodeAsync(tmdbId, seasonNumber, episodeNumber);

        var episodeInfo = new EpisodeInfo
        {
            EpisodeNumber = episode.EpisodeNumber
        };
        
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

    public async Task<string?> GetImageUrlAsync(string path, string size) => await tmdbClient.GetImageUrl(path, size);
}
