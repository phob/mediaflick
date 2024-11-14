using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using TMDbLib.Client;
using PlexLocalScan.Console.Options;
using Microsoft.Extensions.Caching.Memory;
using PlexLocalScan.Console.Models;

namespace PlexLocalScan.Console.Services;

public partial class MediaDetectionService : IMediaDetectionService
{
    private readonly ILogger<MediaDetectionService> _logger;
    private readonly TMDbClient _tmdbClient;
    
    // Common patterns for media files
    private static readonly Regex MoviePattern = new(
        @"^(?<title>.+?)[\. \[]?(?<year>\d{4}).*\.(mkv|mp4|avi)$",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);
    
    private static readonly Regex TvShowPattern = new(
        @"^(?<title>.+?)[\. \[]?[Ss](?<season>\d{1,2})[\. \[]?[eE](?<episode>\d{1,2})?[-]?(?:[-eE](?<episode2>\d{1,2}))?.*\.(mkv|mp4|avi)$",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly Regex TitleCleanupPattern = new(
        @"^(?<title>.+?)(?:\s\(?(?<year>\d{4})\)?)?\s?[-\s]*$",
        RegexOptions.Compiled | RegexOptions.IgnoreCase);

    // Cache TMDb search results for 24 hours
    private readonly IMemoryCache _cache;
    private static readonly TimeSpan CacheDuration = TimeSpan.FromHours(24);

    private readonly IFileTrackingService _fileTrackingService;

    public MediaDetectionService(
        ILogger<MediaDetectionService> logger, 
        IOptions<PlexOptions> options,
        IMemoryCache cache,
        IFileTrackingService fileTrackingService)
    {
        _logger = logger;
        _cache = cache;
        _fileTrackingService = fileTrackingService;
        if (string.IsNullOrEmpty(options.Value.TMDbApiKey))
            throw new ArgumentException("TMDb API key is required but was not provided in configuration");
            
        _tmdbClient = new TMDbClient(options.Value.TMDbApiKey);
    }

    public async Task<MediaInfo?> DetectMediaAsync(string filePath, MediaType mediaType)
    {
        var fileName = Path.GetFileName(filePath);
        _logger.LogDebug("Attempting to detect media info for: {FileName}", fileName);

        try
        {
            var result = mediaType switch
            {
                MediaType.Movies => await DetectMovieAsync(fileName, filePath),
                MediaType.TvShows => await DetectTvShowAsync(fileName, filePath),
                _ => throw new ArgumentException($"Unsupported media type: {mediaType}")
            };

            if (result == null)
            {
                await _fileTrackingService.UpdateStatusAsync(filePath, null, mediaType, null, FileStatus.Failed);
            }
            return result ?? throw new InvalidOperationException($"Failed to detect media info for {fileName}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error detecting media info for {FileName}", fileName);
            throw;
        }
    }

    private async Task<MediaInfo?> DetectMovieAsync(string fileName, string filePath)
    {
        _logger.LogDebug("Attempting to detect movie pattern for: {FileName}", fileName);
        var match = MoviePattern.Match(fileName);
        if (!match.Success)
        {
            await _fileTrackingService.UpdateStatusAsync(fileName, null, MediaType.Movies, null, FileStatus.Failed);
            _logger.LogDebug("Filename does not match movie pattern: {FileName}", fileName);
            return null;
        }
        _logger.LogDebug("Detected movie pattern - Title: {Title}", match.Groups["title"].Value);

        var title = match.Groups["title"].Value.Replace(".", " ").Trim();
        var yearStr = match.Groups["year"].Value;
        var year = int.Parse(yearStr);

        _logger.LogDebug("Detected movie pattern - Title: {Title}, Year: {Year}", title, year);

        var cacheKey = $"movie_{title}_{year}";
        if (_cache.TryGetValue<MediaInfo>(cacheKey, out var cachedInfo))
        {
            return cachedInfo;
        }

        var searchResults = await _tmdbClient.SearchMovieAsync(title);
        var bestMatch = searchResults.Results
            .Where(m => m.ReleaseDate?.Year == year)
            .MaxBy(m => m.Popularity);

        if (bestMatch == null)
        {
            await _fileTrackingService.UpdateStatusAsync(filePath, null, MediaType.Movies, null, FileStatus.Failed);
            _logger.LogWarning("No TMDb match found for movie: {Title} ({Year})", title, year);
            return null;
        }

        var mediaInfo = new MediaInfo
        {
            Title = bestMatch.Title,
            Year = bestMatch.ReleaseDate?.Year,
            TmdbId = bestMatch.Id,
            MediaType = MediaType.Movies
        };
        await _fileTrackingService.UpdateStatusAsync(fileName, null, MediaType.Movies, bestMatch.Id, FileStatus.Working);

        _cache.Set(cacheKey, mediaInfo, CacheDuration);
        return mediaInfo;
    }

    private async Task<MediaInfo?> DetectTvShowAsync(string fileName, string filePath)
    {
        _logger.LogDebug("Attempting to detect TV show pattern for: {FileName}", fileName);
        var match = TvShowPattern.Match(fileName);
        if (!match.Success)
        {
            await _fileTrackingService.UpdateStatusAsync(filePath, null, MediaType.TvShows, null, FileStatus.Failed);
            _logger.LogDebug("Filename does not match TV show pattern: {FileName}", fileName);
            return null;
        }

        var titleMatch = TitleCleanupPattern.Match(match.Groups["title"].Value.Replace(".", " ").Trim());
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

        _logger.LogDebug("Detected TV show pattern - Title: {Title}, S{Season:D2}E{Episode:D2}", 
            title, season, episode);

        // Check cache first
        var cacheKey = $"tvshow_{title}_{season}_{episode}";
        if (_cache.TryGetValue<MediaInfo>(cacheKey, out var cachedInfo))
        {
            _logger.LogDebug("Cache hit for TV show: {Title} S{Season:D2}E{Episode:D2}", 
                title, season, episode);
            return cachedInfo;
        }

        // Cache miss - search TMDb
        var searchResults = await _tmdbClient.SearchTvShowAsync(title);
        var bestMatch = searchResults.Results
            .OrderByDescending(s => GetTitleSimilarity(title, s.Name))
            .ThenByDescending(s => s.Popularity)
            .FirstOrDefault();

        _logger.LogDebug("TMDb search results for {Title}: {Results}", title, searchResults.Results.Count);
        _logger.LogDebug("Best match: {BestMatch}", bestMatch?.Name);
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
        _logger.LogDebug("Updating status for TV show: {mediaInfo}", mediaInfo);
        await _fileTrackingService.UpdateStatusAsync(filePath, null, MediaType.TvShows, mediaInfo.EpisodeTmdbId, FileStatus.Working);

        // Cache the result
        _cache.Set(cacheKey, mediaInfo, CacheDuration);
        _logger.LogDebug("Cached TV show info for: {Title} S{Season:D2}E{Episode:D2}", 
            mediaInfo.Title, season, episode);

        return mediaInfo;
    }

    private static double GetTitleSimilarity(string searchTitle, string resultTitle)
    {
        // Normalize both titles (remove special characters, make lowercase)
        searchTitle = searchTitle.ToLower().Replace(":", "").Replace("-", "").Trim();
        resultTitle = resultTitle.ToLower().Replace(":", "").Replace("-", "").Trim();

        // Exact match gets highest score
        if (searchTitle == resultTitle) return 1.0;
        
        // Contains full search term gets next highest score
        if (resultTitle.Contains(searchTitle)) return 0.8;
        
        // Calculate word match score
        var searchWords = searchTitle.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var resultWords = resultTitle.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        
        var matchedWords = searchWords.Count(sw => resultWords.Any(rw => rw == sw));
        return (double)matchedWords / Math.Max(searchWords.Length, resultWords.Length);
    }
} 