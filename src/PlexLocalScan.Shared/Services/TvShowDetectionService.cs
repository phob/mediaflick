using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Caching.Memory;
using System.Text.RegularExpressions;
using PlexLocalScan.Core.Media;
using PlexLocalScan.Core.Tables;
using PlexLocalScan.Shared.Interfaces;
using static PlexLocalScan.Shared.Services.RegexTv;
using TMDbLib.Objects.Search;
using PlexLocalScan.Shared.Options;
using System.Globalization;

namespace PlexLocalScan.Shared.Services;

public class TvShowDetectionService(
    ILogger<TvShowDetectionService> logger,
    ITmDbClientWrapper tmdbClient,
    IMemoryCache cache,
    IOptionsSnapshot<MediaDetectionOptions> options)
    : ITvShowDetectionService
{
    private readonly MediaDetectionOptions _options = options.Value;
    private readonly Regex _tvShowPattern = BasicSeasonEpisodeRegex;
    private readonly Regex _titleCleanupPattern = FinerTitleRegex;
    private readonly MediaInfo _emptyMediaInfo = new()
    {
        MediaType = MediaType.TvShows
    };

    public async Task<MediaInfo> DetectTvShowAsync(string fileName, string filePath)
    {
        try
        {
            logger.LogDebug("Attempting to detect TV show pattern for: {FileName}", fileName);
            var fileNameWithoutExtension = Path.GetFileNameWithoutExtension(fileName);
            var match = _tvShowPattern.Match(fileNameWithoutExtension);
            var titleMatch = _titleCleanupPattern.Match(match.Groups["title"].Value.Replace(".", " ", StringComparison.OrdinalIgnoreCase).Trim());
            if (!match.Success || !titleMatch.Success)
            {
                logger.LogDebug("Filename does not match TV show pattern: {FileName}", fileName);
                return _emptyMediaInfo;
            }

            var title = titleMatch.Groups["title"].Value;
            var season = int.Parse(match.Groups["season"].Value, CultureInfo.InvariantCulture);
            var episode = int.Parse(match.Groups["episode"].Value, CultureInfo.InvariantCulture);
            int? episode2 = match.Groups["episode2"].Success
                ? int.Parse(match.Groups["episode2"].Value, CultureInfo.InvariantCulture)
                : null;

            var cacheKey = $"tvshow_{title}_{season}_{episode}";
            if (cache.TryGetValue<MediaInfo>(cacheKey, out var cachedInfo))
            {
                return cachedInfo ?? _emptyMediaInfo;
            }

            var bestMatch =  await TmdbSearchShowAsync(title);
            if (bestMatch == null)
            {
                return _emptyMediaInfo;
            }
            var tvShowDetails = await tmdbClient.GetTvShowAsync(bestMatch.Id);
            var episodeInfo = await tmdbClient.GetTvEpisodeAsync(bestMatch.Id, season, episode);
            var externalIds = await tmdbClient.GetTvShowExternalIdsAsync(bestMatch.Id);
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
                Genres = tvShowDetails.Genres?.Select(g => g.Name).ToList().AsReadOnly()
            };
            cache.Set(cacheKey, mediaInfo, TimeSpan.FromSeconds(_options.CacheDuration));
            return mediaInfo;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error detecting TV show: {FileName}", fileName);
            return _emptyMediaInfo;
        }
    }

    private async Task<SearchTv?> TmdbSearchShowAsync(string title)
    {
        var searchResults = await tmdbClient.SearchTvShowAsync(title);
        if (searchResults.Results.Count == 0)
        {
            searchResults = await tmdbClient.SearchTvShowAsync(title.Replace("complete", "", StringComparison.OrdinalIgnoreCase));
        }
        var bestMatch = searchResults.Results
            .OrderByDescending(s => GetTitleSimilarity(title, s.Name))
            .ThenByDescending(s => s.Popularity)
            .FirstOrDefault();
        if (bestMatch != null)
        {
            return bestMatch;
        }

        logger.LogWarning("No TMDb match found for TV show: {Title}", title);
        return null;
    }

    public async Task<MediaInfo> DetectTvShowByTmdbIdAsync(int tmdbId, int season, int episode)
    {
        try
        {
            var cacheKey = $"tvshow_tmdb_{tmdbId}_{season}_{episode}";
            if (cache.TryGetValue<MediaInfo>(cacheKey, out var cachedInfo))
            {
                return cachedInfo ?? _emptyMediaInfo;
            }

            var tvShowDetails = await tmdbClient.GetTvShowAsync(tmdbId);
            if (tvShowDetails == null)
            {
                logger.LogWarning("No TMDb show found for ID: {TmdbId}", tmdbId);
                return _emptyMediaInfo;
            }

            var episodeInfo = await tmdbClient.GetTvEpisodeAsync(tmdbId, season, episode);
            var externalIds = await tmdbClient.GetTvShowExternalIdsAsync(tmdbId);

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
                Genres = tvShowDetails.Genres?.Select(g => g.Name).ToList().AsReadOnly()
            };

            cache.Set(cacheKey, mediaInfo, TimeSpan.FromSeconds(_options.CacheDuration));
            return mediaInfo;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error detecting TV show by TMDb ID: {TmdbId}", tmdbId);
            return _emptyMediaInfo;
        }
    }

    private static double GetTitleSimilarity(string searchTitle, string resultTitle)
    {
        static string NormalizeForComparison(string input) =>
            input.ToUpperInvariant().Replace(":", "", StringComparison.OrdinalIgnoreCase).Replace("-", "", StringComparison.OrdinalIgnoreCase).Trim();

        searchTitle = NormalizeForComparison(searchTitle);
        resultTitle = NormalizeForComparison(resultTitle);

        if (searchTitle == resultTitle)
        {
            return 1.0;
        }

        if (resultTitle.Contains(searchTitle, StringComparison.OrdinalIgnoreCase))
        {
            return 0.8;
        }

        var searchWords = searchTitle.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var resultWords = resultTitle.Split(' ', StringSplitOptions.RemoveEmptyEntries);

        var matchedWords = searchWords.Count(sw => resultWords.Any(rw => rw == sw));
        return (double)matchedWords / Math.Max(searchWords.Length, resultWords.Length);
    }
} 
