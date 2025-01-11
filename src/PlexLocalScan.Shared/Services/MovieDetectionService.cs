using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Caching.Memory;
using System.Text.RegularExpressions;
using PlexLocalScan.Core.Media;
using PlexLocalScan.Core.Tables;
using PlexLocalScan.FileTracking.Services;
using PlexLocalScan.Shared.Interfaces;
using PlexLocalScan.Shared.Options;
using System.Globalization;

namespace PlexLocalScan.Shared.Services;

public class MovieDetectionService : IMovieDetectionService
{
    private readonly ILogger<MovieDetectionService> _logger;
    private readonly ITmDbClientWrapper _tmdbClient;
    private readonly IMemoryCache _cache;
    private readonly IContextService _fileTrackingService;
    private readonly MediaDetectionOptions _options;
    private readonly Regex _moviePattern;
    private readonly MediaInfo _emptyMediaInfo = new()
    {
        MediaType = MediaType.Movies
    };

    public MovieDetectionService(
        ILogger<MovieDetectionService> logger,
        ITmDbClientWrapper tmdbClient,
        IMemoryCache cache,
        IContextService fileTrackingService,
        IOptions<MediaDetectionOptions> options)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        _tmdbClient = tmdbClient ?? throw new ArgumentNullException(nameof(tmdbClient));
        _cache = cache ?? throw new ArgumentNullException(nameof(cache));
        _fileTrackingService = fileTrackingService ?? throw new ArgumentNullException(nameof(fileTrackingService));
        _options = options?.Value ?? throw new ArgumentNullException(nameof(options));

        _moviePattern = new Regex(_options.MoviePattern, RegexOptions.Compiled | RegexOptions.IgnoreCase);
    }

    public async Task<MediaInfo?> DetectMovieAsync(string fileName, string filePath)
    {
        try
        {
            _logger.LogDebug("Attempting to detect movie pattern for: {FileName}", fileName);
            Match match = _moviePattern.Match(fileName);
            if (!match.Success)
            {
                await _fileTrackingService.UpdateStatusAsync(fileName, null, _emptyMediaInfo, FileStatus.Failed);
                _logger.LogDebug("Filename does not match movie pattern: {FileName}", fileName);
                return null;
            }

            string title = match.Groups["title"].Value.Replace(".", " ", StringComparison.OrdinalIgnoreCase).Trim();
            string yearStr = match.Groups["year"].Value;
            int year = int.Parse(yearStr, CultureInfo.CurrentCulture);

            _logger.LogDebug("Detected movie pattern - Title: {Title}, Year: {Year}", title, year);

            string cacheKey = $"movie_{title}_{year}";
            if (_cache.TryGetValue<MediaInfo>(cacheKey, out MediaInfo? cachedInfo))
            {
                return cachedInfo;
            }

            MediaInfo mediaInfo = await SearchTmDbForMovie(title, year, filePath);
            mediaInfo.MediaType = MediaType.Movies;
            if (mediaInfo == null)
            {
                return null;
            }

            _cache.Set(cacheKey, mediaInfo, _options.CacheDuration);
            await _fileTrackingService.UpdateStatusAsync(filePath, null, mediaInfo, FileStatus.Processing);
            return mediaInfo;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error detecting movie: {FileName}", fileName);
            return null;
        }
    }

    private async Task<MediaInfo> SearchTmDbForMovie(string title, int year, string filePath)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            throw new ArgumentException("Title cannot be empty or whitespace", nameof(title));
        }

        if (year <= 1800 || year > DateTime.Now.Year + 5)
        {
            throw new ArgumentOutOfRangeException(nameof(year), "Year must be between 1800 and 5 years in the future");
        }

        TMDbLib.Objects.General.SearchContainer<TMDbLib.Objects.Search.SearchMovie> searchResults = await _tmdbClient.SearchMovieAsync(title);

        if (searchResults?.Results == null)
        {
            _logger.LogError("TMDb API returned null or invalid response for title: {Title}", title);
            await _fileTrackingService.UpdateStatusAsync(filePath, null, _emptyMediaInfo, FileStatus.Failed);
            return _emptyMediaInfo;
        }

        TMDbLib.Objects.Search.SearchMovie? bestMatch = searchResults.Results
            .Where(m => m.ReleaseDate?.Year == year)
            .MaxBy(m => m.Popularity);

        if (bestMatch == null)
        {
            _logger.LogWarning("No TMDb match found for movie: {Title} ({Year})", title, year);
            await _fileTrackingService.UpdateStatusAsync(filePath, null, _emptyMediaInfo, FileStatus.Failed);
            return _emptyMediaInfo;
        }
        TMDbLib.Objects.General.ExternalIdsMovie externalIds = await _tmdbClient.GetMovieExternalIdsAsync(bestMatch.Id);

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
            string cacheKey = $"movie_tmdb_{tmdbId}";
            if (_cache.TryGetValue<MediaInfo>(cacheKey, out MediaInfo? cachedInfo))
            {
                return cachedInfo;
            }

            TMDbLib.Objects.Movies.Movie movieDetails = await _tmdbClient.GetMovieAsync(tmdbId);
            if (movieDetails == null)
            {
                _logger.LogWarning("No TMDb movie found for ID: {TmdbId}", tmdbId);
                return null;
            }

            TMDbLib.Objects.General.ExternalIdsMovie externalIds = await _tmdbClient.GetMovieExternalIdsAsync(movieDetails.Id);

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