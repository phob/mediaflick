using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Caching.Memory;
using System.Text.RegularExpressions;
using PlexLocalScan.Core.Media;
using PlexLocalScan.Core.Tables;
using PlexLocalScan.FileTracking.Services;
using PlexLocalScan.Shared.Interfaces;

namespace PlexLocalScan.Shared.Services;

public class TvShowDetectionService : ITvShowDetectionService
{
    private readonly ILogger<TvShowDetectionService> _logger;
    private readonly ITmDbClientWrapper _tmdbClient;
    private readonly IMemoryCache _cache;
    private readonly IContextService _contextService;
    private readonly MediaDetectionOptions _options;
    private readonly Regex _tvShowPattern;
    private readonly Regex _titleCleanupPattern;

    public TvShowDetectionService(
        ILogger<TvShowDetectionService> logger,
        ITmDbClientWrapper tmdbClient,
        IMemoryCache cache,
        IContextService contextService,
        IOptions<MediaDetectionOptions> options)
    {
        _logger = logger;
        _tmdbClient = tmdbClient;
        _cache = cache;
        _contextService = contextService;
        _options = options.Value;

        _tvShowPattern = new Regex(_options.TvShowPattern, RegexOptions.Compiled | RegexOptions.IgnoreCase);
        _titleCleanupPattern = new Regex(_options.TitleCleanupPattern, RegexOptions.Compiled | RegexOptions.IgnoreCase);
    }

    public async Task<MediaInfo?> DetectTvShowAsync(string fileName, string filePath)
    {
        try
        {
            _logger.LogDebug("Attempting to detect TV show pattern for: {FileName}", fileName);
            var match = _tvShowPattern.Match(fileName);
            if (!match.Success)
            {
                await _contextService.UpdateStatusAsync(filePath, null, MediaType.TvShows, null, null, null, null, null, null, null, FileStatus.Failed);
                _logger.LogDebug("Filename does not match TV show pattern: {FileName}", fileName);
                return null;
            }

            var titleMatch = _titleCleanupPattern.Match(match.Groups["title"].Value.Replace(".", " ").Trim());
            if (!titleMatch.Success)
            {
                await _contextService.UpdateStatusAsync(filePath, null, MediaType.TvShows, null, null, null, null, null, null, null, FileStatus.Failed);
                _logger.LogWarning("Failed to clean title for TV show: {FileName}", fileName);
                return null;
            }

            var title = titleMatch.Groups["title"].Value;
            var season = int.Parse(match.Groups["season"].Value);
            var episode = int.Parse(match.Groups["episode"].Value);
            var episode2 = match.Groups["episode2"].Success 
                ? int.Parse(match.Groups["episode2"].Value) 
                : (int?)null;

            var cacheKey = $"tvshow_{title}_{season}_{episode}";
            if (_cache.TryGetValue<MediaInfo>(cacheKey, out var cachedInfo) && cachedInfo != null)
            {
                await _contextService.UpdateStatusAsync(filePath, null, MediaType.TvShows, cachedInfo.TmdbId, cachedInfo.ImdbId, cachedInfo.SeasonNumber, cachedInfo.EpisodeNumber, cachedInfo.Genres, cachedInfo.Title, cachedInfo.Year, FileStatus.Processing);
                return cachedInfo;
            }

            var searchResults = await _tmdbClient.SearchTvShowAsync(title);
            var bestMatch = searchResults.Results
                .OrderByDescending(s => GetTitleSimilarity(title, s.Name))
                .ThenByDescending(s => s.Popularity)
                .FirstOrDefault();

            if (bestMatch == null)
            {
                await _contextService.UpdateStatusAsync(filePath, null, MediaType.TvShows, null, null, null, null, null, null, null, FileStatus.Failed);
                _logger.LogWarning("No TMDb match found for TV show: {Title}", title);
                return null;
            }

            var tvShowDetails = await _tmdbClient.GetTvShowAsync(bestMatch.Id);
            var episodeInfo = await _tmdbClient.GetTvEpisodeAsync(bestMatch.Id, season, episode);
            var externalIds = await _tmdbClient.GetTvShowExternalIdsAsync(bestMatch.Id);
            var mediaInfo = new MediaInfo
            {
                Title = bestMatch.Name,
                Year = bestMatch.FirstAirDate?.Year,
                TmdbId = bestMatch.Id,
                ImdbId = externalIds.ImdbId,
                MediaType = MediaType.TvShows,
                SeasonNumber = season,
                EpisodeNumber = episode,
                EpisodeNumber2 = episode2,
                EpisodeTitle = episodeInfo?.Name,
                EpisodeTmdbId = episodeInfo?.Id,
                Genres = tvShowDetails.Genres?.Select(g => g.Name).ToList()
            };
            await _contextService.UpdateStatusAsync(filePath, null, MediaType.TvShows, mediaInfo.TmdbId, mediaInfo.ImdbId, mediaInfo.SeasonNumber, mediaInfo.EpisodeNumber, mediaInfo.Genres, mediaInfo.Title, mediaInfo.Year, FileStatus.Processing);
            _cache.Set(cacheKey, mediaInfo, _options.CacheDuration);
            return mediaInfo;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error detecting TV show: {FileName}", fileName);
            return null;
        }
    }

    public async Task<MediaInfo?> DetectTvShowByTmdbIdAsync(int tmdbId, int season, int episode)
    {
        try
        {
            var cacheKey = $"tvshow_tmdb_{tmdbId}_{season}_{episode}";
            if (_cache.TryGetValue<MediaInfo>(cacheKey, out var cachedInfo))
            {
                return cachedInfo;
            }

            var tvShowDetails = await _tmdbClient.GetTvShowAsync(tmdbId);
            if (tvShowDetails == null)
            {
                _logger.LogWarning("No TMDb show found for ID: {TmdbId}", tmdbId);
                return null;
            }

            var episodeInfo = await _tmdbClient.GetTvEpisodeAsync(tmdbId, season, episode);
            var externalIds = await _tmdbClient.GetTvShowExternalIdsAsync(tmdbId);

            var mediaInfo = new MediaInfo
            {
                Title = tvShowDetails.Name,
                Year = tvShowDetails.FirstAirDate?.Year,
                TmdbId = tvShowDetails.Id,
                ImdbId = externalIds.ImdbId,
                MediaType = MediaType.TvShows,
                SeasonNumber = season,
                EpisodeNumber = episode,
                EpisodeTitle = episodeInfo?.Name,
                EpisodeTmdbId = episodeInfo?.Id,
                Genres = tvShowDetails.Genres?.Select(g => g.Name).ToList()
            };

            _cache.Set(cacheKey, mediaInfo, _options.CacheDuration);
            return mediaInfo;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error detecting TV show by TMDb ID: {TmdbId}", tmdbId);
            return null;
        }
    }

    private static double GetTitleSimilarity(string searchTitle, string resultTitle)
    {
        static string NormalizeForComparison(string input) =>
            input.ToLower().Replace(":", "").Replace("-", "").Trim();

        searchTitle = NormalizeForComparison(searchTitle);
        resultTitle = NormalizeForComparison(resultTitle);

        if (searchTitle == resultTitle) return 1.0;
        if (resultTitle.Contains(searchTitle)) return 0.8;
        
        var searchWords = searchTitle.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var resultWords = resultTitle.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        
        var matchedWords = searchWords.Count(sw => resultWords.Any(rw => rw == sw));
        return (double)matchedWords / Math.Max(searchWords.Length, resultWords.Length);
    }
} 