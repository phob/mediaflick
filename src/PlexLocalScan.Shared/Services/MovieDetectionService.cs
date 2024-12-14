using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Caching.Memory;
using System.Text.RegularExpressions;
using PlexLocalScan.Data.Models;
using PlexLocalScan.Shared.Interfaces;
using PlexLocalScan.Shared.Models.Media;

namespace PlexLocalScan.Shared.Services;

public class MovieDetectionService : IMovieDetectionService
{
    private readonly ILogger<MovieDetectionService> _logger;
    private readonly ITMDbClientWrapper _tmdbClient;
    private readonly IMemoryCache _cache;
    private readonly IFileTrackingService _fileTrackingService;
    private readonly MediaDetectionOptions _options;
    private readonly IDateTimeProvider _dateTimeProvider;
    private readonly Regex _moviePattern;

    public MovieDetectionService(
        ILogger<MovieDetectionService> logger,
        ITMDbClientWrapper tmdbClient,
        IMemoryCache cache,
        IFileTrackingService fileTrackingService,
        IOptions<MediaDetectionOptions> options,
        IDateTimeProvider dateTimeProvider)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _tmdbClient = tmdbClient ?? throw new ArgumentNullException(nameof(tmdbClient));
        _cache = cache ?? throw new ArgumentNullException(nameof(cache));
        _fileTrackingService = fileTrackingService ?? throw new ArgumentNullException(nameof(fileTrackingService));
        _options = options?.Value ?? throw new ArgumentNullException(nameof(options));
        _dateTimeProvider = dateTimeProvider ?? throw new ArgumentNullException(nameof(dateTimeProvider));

        _moviePattern = new Regex(_options.MoviePattern, RegexOptions.Compiled | RegexOptions.IgnoreCase);
    }

    public async Task<MediaInfo?> DetectMovieAsync(string fileName, string filePath)
    {
        try
        {
            _logger.LogDebug("Attempting to detect movie pattern for: {FileName}", fileName);
            var match = _moviePattern.Match(fileName);
            if (!match.Success)
            {
                await _fileTrackingService.UpdateStatusAsync(fileName, null, MediaType.Movies, null, null, FileStatus.Failed);
                _logger.LogDebug("Filename does not match movie pattern: {FileName}", fileName);
                return null;
            }

            var title = match.Groups["title"].Value.Replace(".", " ").Trim();
            var yearStr = match.Groups["year"].Value;
            var year = int.Parse(yearStr);

            _logger.LogDebug("Detected movie pattern - Title: {Title}, Year: {Year}", title, year);

            var cacheKey = $"movie_{title}_{year}";
            if (_cache.TryGetValue<MediaInfo>(cacheKey, out var cachedInfo))
            {
                return cachedInfo;
            }

            var mediaInfo = await SearchTMDbForMovie(title, year, filePath);
            if (mediaInfo == null)
            {
                return null;
            }

            _cache.Set(cacheKey, mediaInfo, _options.CacheDuration);
            await _fileTrackingService.UpdateStatusAsync(filePath, null, MediaType.Movies, mediaInfo.TmdbId, mediaInfo.ImdbId, FileStatus.Processing);
            return mediaInfo;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error detecting movie: {FileName}", fileName);
            return null;
        }
    }

    private async Task<MediaInfo?> SearchTMDbForMovie(string title, int year, string filePath)
    {
        if (string.IsNullOrWhiteSpace(title))
            throw new ArgumentException("Title cannot be empty or whitespace", nameof(title));

        if (year <= 1800 || year > _dateTimeProvider.Now.Year + 5)
            throw new ArgumentOutOfRangeException(nameof(year), "Year must be between 1800 and 5 years in the future");

        var searchResults = await _tmdbClient.SearchMovieAsync(title);

        if (searchResults?.Results == null)
        {
            _logger.LogError("TMDb API returned null or invalid response for title: {Title}", title);
            await _fileTrackingService.UpdateStatusAsync(filePath, null, MediaType.Movies, null, null, FileStatus.Failed);
            return null;
        }

        var bestMatch = searchResults.Results
            .Where(m => m.ReleaseDate?.Year == year)
            .MaxBy(m => m.Popularity);

        if (bestMatch == null)
        {
            _logger.LogWarning("No TMDb match found for movie: {Title} ({Year})", title, year);
            await _fileTrackingService.UpdateStatusAsync(filePath, null, MediaType.Movies, null, null, FileStatus.Failed);
            return null;
        }
        var externalIds = await _tmdbClient.GetMovieExternalIdsAsync(bestMatch.Id);

        return new MediaInfo
        {
            Title = bestMatch.Title,
            Year = bestMatch.ReleaseDate?.Year,
            TmdbId = bestMatch.Id,
            ImdbId = externalIds.ImdbId,
            MediaType = MediaType.Movies
        };
    }

    public async Task<MediaInfo?> DetectMovieByTmdbIdAsync(int tmdbId)
    {
        try
        {
            var cacheKey = $"movie_tmdb_{tmdbId}";
            if (_cache.TryGetValue<MediaInfo>(cacheKey, out var cachedInfo))
            {
                return cachedInfo;
            }

            var movieDetails = await _tmdbClient.GetMovieAsync(tmdbId);
            if (movieDetails == null)
            {
                _logger.LogWarning("No TMDb movie found for ID: {TmdbId}", tmdbId);
                return null;
            }

            var externalIds = await _tmdbClient.GetMovieExternalIdsAsync(movieDetails.Id);

            var mediaInfo = new MediaInfo
            {
                Title = movieDetails.Title,
                Year = movieDetails.ReleaseDate?.Year,
                TmdbId = movieDetails.Id,
                ImdbId = externalIds.ImdbId,
                MediaType = MediaType.Movies
            };

            _cache.Set(cacheKey, mediaInfo, _options.CacheDuration);
            return mediaInfo;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error detecting movie by TMDb ID: {TmdbId}", tmdbId);
            return null;
        }
    }
} 