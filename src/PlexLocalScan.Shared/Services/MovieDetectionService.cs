using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Caching.Memory;
using System.Globalization;
using System.Text.RegularExpressions;
using PlexLocalScan.Core.Media;
using PlexLocalScan.Core.Tables;
using PlexLocalScan.Shared.Interfaces;
using PlexLocalScan.Shared.Options;
using static PlexLocalScan.Shared.Services.RegexMovie;

namespace PlexLocalScan.Shared.Services;

public class MovieDetectionService(
    ILogger<MovieDetectionService> logger,
    ITmDbClientWrapper tmdbClient,
    IMemoryCache cache,
    IOptionsSnapshot<MediaDetectionOptions> options) : IMovieDetectionService
{
    private readonly MediaDetectionOptions _options = options.Value;
    private readonly Regex _moviePattern = BasicMovieRegex;

    public async Task<MediaInfo> DetectMovieAsync(string fileName, string filePath)
    {
        var emptyMediaInfo = new MediaInfo
        {
            MediaType = MediaType.Movies
        };
        try
        {
            var fileNameWithoutExtension = Path.GetFileNameWithoutExtension(fileName);
            logger.LogDebug("Attempting to detect movie pattern for: {FileName}", fileName);
            var match = _moviePattern.Match(fileNameWithoutExtension);
            if (!match.Success)
            {
                logger.LogDebug("Filename does not match movie pattern: {FileName}", fileName);
                return emptyMediaInfo;
            }

            var title = match.Groups["title"].Value.Replace(".", " ", StringComparison.OrdinalIgnoreCase).Trim();
            var yearStr = match.Groups["year"].Value;
            var year = int.Parse(yearStr, CultureInfo.CurrentCulture);

            logger.LogDebug("Detected movie pattern - Title: {Title}, Year: {Year}", title, year);

            var cacheKey = $"movie_{title}_{year}";
            if (cache.TryGetValue<MediaInfo>(cacheKey, out var cachedInfo))
            {
                return cachedInfo ?? emptyMediaInfo;
            }

            var mediaInfo = await SearchTmDbForMovie(title, year, emptyMediaInfo);
            mediaInfo.MediaType = MediaType.Movies;

            cache.Set(cacheKey, mediaInfo, TimeSpan.FromSeconds(_options.CacheDuration));
            return mediaInfo;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error detecting movie: {FileName}", fileName);
            return emptyMediaInfo;
        }
    }

    private async Task<MediaInfo> SearchTmDbForMovie(string title, int year, MediaInfo emptyMediaInfo)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            throw new ArgumentException("Title cannot be empty or whitespace", nameof(title));
        }

        if (year <= 1800 || year > DateTime.Now.Year + 5)
        {
            throw new ArgumentOutOfRangeException(nameof(year), "Year must be between 1800 and 5 years in the future");
        }

        var searchResults = await tmdbClient.SearchMovieAsync(title);

        if (searchResults?.Results == null)
        {
            logger.LogError("TMDb API returned null or invalid response for title: {Title}", title);
            return emptyMediaInfo;
        }

        var bestMatch = searchResults.Results
            .Where(m => m.ReleaseDate?.Year == year)
            .MaxBy(m => m.Popularity);

        if (bestMatch == null)
        {
            logger.LogWarning("No TMDb match found for movie: {Title} ({Year})", title, year);
            return emptyMediaInfo;
        }
        var externalIds = await tmdbClient.GetMovieExternalIdsAsync(bestMatch.Id);

        return new MediaInfo
        {
            Title = bestMatch.Title,
            Year = bestMatch.ReleaseDate?.Year,
            TmdbId = bestMatch.Id,
            ImdbId = externalIds.ImdbId,
            MediaType = MediaType.Movies
        };
    }

    public async Task<MediaInfo> DetectMovieByTmdbIdAsync(int tmdbId)
    {
        var emptyMediaInfo = new MediaInfo
        {
            MediaType = MediaType.Movies
        };
        try
        {
            var cacheKey = $"movie_tmdb_{tmdbId}";
            if (cache.TryGetValue<MediaInfo>(cacheKey, out var cachedInfo))
            {
                return cachedInfo ?? emptyMediaInfo;
            }

            var movieDetails = await tmdbClient.GetMovieAsync(tmdbId);

            var externalIds = await tmdbClient.GetMovieExternalIdsAsync(movieDetails.Id);

            var mediaInfo = new MediaInfo
            {
                Title = movieDetails.Title,
                Year = movieDetails.ReleaseDate?.Year,
                TmdbId = movieDetails.Id,
                ImdbId = externalIds.ImdbId,
                MediaType = MediaType.Movies
            };

            cache.Set(cacheKey, mediaInfo, TimeSpan.FromSeconds(_options.CacheDuration));
            return mediaInfo;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error detecting movie by TMDb ID: {TmdbId}", tmdbId);
            return emptyMediaInfo;
        }
    }
} 

