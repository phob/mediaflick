using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Caching.Memory;
using System.Text.RegularExpressions;
using PlexLocalScan.Data.Models;
using PlexLocalScan.Shared.Interfaces;

namespace PlexLocalScan.Shared.Services;

public class TvShowDetectionService : ITvShowDetectionService
{
    private readonly ILogger<TvShowDetectionService> _logger;
    private readonly ITMDbClientWrapper _tmdbClient;
    private readonly IMemoryCache _cache;
    private readonly IFileTrackingService _fileTrackingService;
    private readonly MediaDetectionOptions _options;
    private readonly Regex _tvShowPattern;
    private readonly Regex _titleCleanupPattern;

    public TvShowDetectionService(
        ILogger<TvShowDetectionService> logger,
        ITMDbClientWrapper tmdbClient,
        IMemoryCache cache,
        IFileTrackingService fileTrackingService,
        IOptions<MediaDetectionOptions> options)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _tmdbClient = tmdbClient ?? throw new ArgumentNullException(nameof(tmdbClient));
        _cache = cache ?? throw new ArgumentNullException(nameof(cache));
        _fileTrackingService = fileTrackingService ?? throw new ArgumentNullException(nameof(fileTrackingService));
        _options = options?.Value ?? throw new ArgumentNullException(nameof(options));

        _tvShowPattern = new Regex(_options.TvShowPattern, RegexOptions.Compiled | RegexOptions.IgnoreCase);
        _titleCleanupPattern = new Regex(_options.TitleCleanupPattern, RegexOptions.Compiled | RegexOptions.IgnoreCase);
    }

    public async Task<MediaInfo?> DetectTvShowAsync(string fileName, string filePath)
    {
        _logger.LogDebug("Attempting to detect TV show pattern for: {FileName}", fileName);
        var match = _tvShowPattern.Match(fileName);
        if (!match.Success)
        {
            await _fileTrackingService.UpdateStatusAsync(filePath, null, MediaType.TvShows, null, FileStatus.Failed);
            _logger.LogDebug("Filename does not match TV show pattern: {FileName}", fileName);
            return null;
        }

        var titleMatch = _titleCleanupPattern.Match(match.Groups["title"].Value.Replace(".", " ").Trim());
        if (!titleMatch.Success)
        {
            await _fileTrackingService.UpdateStatusAsync(filePath, null, MediaType.TvShows, null, FileStatus.Failed);
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
        if (_cache.TryGetValue<MediaInfo>(cacheKey, out var cachedInfo))
        {
            return cachedInfo;
        }

        var searchResults = await _tmdbClient.SearchTvShowAsync(title);
        var bestMatch = searchResults.Results
            .OrderByDescending(s => GetTitleSimilarity(title, s.Name))
            .ThenByDescending(s => s.Popularity)
            .FirstOrDefault();

        if (bestMatch == null)
        {
            await _fileTrackingService.UpdateStatusAsync(filePath, null, MediaType.TvShows, null, FileStatus.Failed);
            _logger.LogWarning("No TMDb match found for TV show: {Title}", title);
            return null;
        }

        var episodeInfo = await _tmdbClient.GetTvEpisodeAsync(bestMatch.Id, season, episode);
        var mediaInfo = new MediaInfo
        {
            Title = bestMatch.Name,
            Year = bestMatch.FirstAirDate?.Year,
            TmdbId = episodeInfo?.Id,
            MediaType = MediaType.TvShows,
            SeasonNumber = season,
            EpisodeNumber = episode,
            EpisodeNumber2 = episode2,
            EpisodeTitle = episodeInfo?.Name,
            EpisodeTmdbId = episodeInfo?.Id
        };

        _cache.Set(cacheKey, mediaInfo, _options.CacheDuration);
        return mediaInfo;
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