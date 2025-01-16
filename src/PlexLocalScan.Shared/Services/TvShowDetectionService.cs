using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Caching.Memory;
using System.Text.RegularExpressions;
using PlexLocalScan.Core.Media;
using PlexLocalScan.Core.Tables;
using PlexLocalScan.FileTracking.Services;
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
    IContextService contextService,
    IOptions<MediaDetectionOptions> options)
    : ITvShowDetectionService
{
    private readonly MediaDetectionOptions _options = options.Value;
    private readonly Regex _tvShowPattern = BasicSeasonEpisodeRegex;
    private readonly Regex _titleCleanupPattern = FinerTitleRegex;

    public async Task<MediaInfo?> DetectTvShowAsync(string fileName, string filePath)
    {
        try
        {
            logger.LogDebug("Attempting to detect TV show pattern for: {FileName}", fileName);
            var emptyMediaInfo = new MediaInfo
            {
                MediaType = MediaType.TvShows
            };
            Match match = _tvShowPattern.Match(fileName);
            if (!match.Success)
            {
                await contextService.UpdateStatusAsync(filePath, null, emptyMediaInfo, FileStatus.Failed);
                logger.LogDebug("Filename does not match TV show pattern: {FileName}", fileName);
                return null;
            }

            Match titleMatch = _titleCleanupPattern.Match(match.Groups["title"].Value.Replace(".", " ", StringComparison.OrdinalIgnoreCase).Trim());
            if (!titleMatch.Success)
            {
                await contextService.UpdateStatusAsync(filePath, null, emptyMediaInfo, FileStatus.Failed);
                logger.LogWarning("Failed to clean title for TV show: {FileName}", fileName);
                return null;
            }

            string title = titleMatch.Groups["title"].Value;
            int season = int.Parse(match.Groups["season"].Value, CultureInfo.InvariantCulture);
            int episode = int.Parse(match.Groups["episode"].Value, CultureInfo.InvariantCulture);
            int? episode2 = match.Groups["episode2"].Success
                ? int.Parse(match.Groups["episode2"].Value, CultureInfo.InvariantCulture)
                : null;

            string cacheKey = $"tvshow_{title}_{season}_{episode}";
            if (cache.TryGetValue<MediaInfo>(cacheKey, out MediaInfo? cachedInfo) && cachedInfo != null)
            {
                var cachedMediaInfo = new MediaInfo
                {
                    MediaType = MediaType.TvShows,
                    TmdbId = cachedInfo.TmdbId,
                    ImdbId = cachedInfo.ImdbId,
                    SeasonNumber = cachedInfo.SeasonNumber,
                    EpisodeNumber = cachedInfo.EpisodeNumber,
                    Genres = cachedInfo.Genres,
                    Title = cachedInfo.Title,
                    Year = cachedInfo.Year
                };
                await contextService.UpdateStatusAsync(filePath, null, cachedMediaInfo, FileStatus.Processing);
                return cachedInfo;
            }

            SearchTv? bestMatch =  await TmdbSearchShowAsync(filePath, emptyMediaInfo, title);
            if (bestMatch == null)
            {
                return null;
            }
            TMDbLib.Objects.TvShows.TvShow tvShowDetails = await tmdbClient.GetTvShowAsync(bestMatch.Id);
            TMDbLib.Objects.TvShows.TvEpisode? episodeInfo = await tmdbClient.GetTvEpisodeAsync(bestMatch.Id, season, episode);
            TMDbLib.Objects.General.ExternalIdsTvShow externalIds = await tmdbClient.GetTvShowExternalIdsAsync(bestMatch.Id);
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
            await contextService.UpdateStatusAsync(filePath, null, mediaInfo, FileStatus.Processing);
            cache.Set(cacheKey, mediaInfo, _options.CacheDurationSeconds);
            return mediaInfo;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error detecting TV show: {FileName}", fileName);
            return null;
        }
    }

    private async Task<SearchTv?> TmdbSearchShowAsync(string filePath, MediaInfo emptyMediaInfo, string title)
    {
        TMDbLib.Objects.General.SearchContainer<SearchTv> searchResults = await tmdbClient.SearchTvShowAsync(title);
        if (searchResults.Results.Count == 0)
        {
            searchResults = await tmdbClient.SearchTvShowAsync(title.Replace("complete", "", StringComparison.OrdinalIgnoreCase));
        }
        SearchTv? bestMatch = searchResults.Results
            .OrderByDescending(s => GetTitleSimilarity(title, s.Name))
            .ThenByDescending(s => s.Popularity)
            .FirstOrDefault();
        if (bestMatch == null)
        {
            await contextService.UpdateStatusAsync(filePath, null, emptyMediaInfo, FileStatus.Failed);
            logger.LogWarning("No TMDb match found for TV show: {Title}", title);
            return null;
        }
        return bestMatch;
    }

    public async Task<MediaInfo?> DetectTvShowByTmdbIdAsync(int tmdbId, int season, int episode)
    {
        try
        {
            string cacheKey = $"tvshow_tmdb_{tmdbId}_{season}_{episode}";
            if (cache.TryGetValue<MediaInfo>(cacheKey, out MediaInfo? cachedInfo))
            {
                return cachedInfo;
            }

            TMDbLib.Objects.TvShows.TvShow tvShowDetails = await tmdbClient.GetTvShowAsync(tmdbId);
            if (tvShowDetails == null)
            {
                logger.LogWarning("No TMDb show found for ID: {TmdbId}", tmdbId);
                return null;
            }

            TMDbLib.Objects.TvShows.TvEpisode? episodeInfo = await tmdbClient.GetTvEpisodeAsync(tmdbId, season, episode);
            TMDbLib.Objects.General.ExternalIdsTvShow externalIds = await tmdbClient.GetTvShowExternalIdsAsync(tmdbId);

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

            cache.Set(cacheKey, mediaInfo, _options.CacheDurationSeconds);
            return mediaInfo;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error detecting TV show by TMDb ID: {TmdbId}", tmdbId);
            return null;
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

        string[] searchWords = searchTitle.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        string[] resultWords = resultTitle.Split(' ', StringSplitOptions.RemoveEmptyEntries);

        int matchedWords = searchWords.Count(sw => resultWords.Any(rw => rw == sw));
        return (double)matchedWords / Math.Max(searchWords.Length, resultWords.Length);
    }
} 
