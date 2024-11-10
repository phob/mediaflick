using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using TMDbLib.Client;
using PlexLocalscan.Options;

namespace PlexLocalscan.Services;

public partial class MediaDetectionService : IMediaDetectionService
{
    private readonly ILogger<MediaDetectionService> _logger;
    private readonly TMDbClient _tmdbClient;
    
    // Common patterns for media files
    private static readonly Regex MoviePattern = MyRegex();
    
    private static readonly Regex TvShowPattern = MyRegex1();

    public MediaDetectionService(
        ILogger<MediaDetectionService> logger, 
        IOptions<PlexOptions> options)
    {
        _logger = logger;
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
                MediaType.Movies => await DetectMovieAsync(fileName),
                MediaType.TvShows => await DetectTvShowAsync(fileName),
                _ => throw new ArgumentException($"Unsupported media type: {mediaType}")
            };

            return result ?? throw new InvalidOperationException($"Failed to detect media info for {fileName}");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error detecting media info for {FileName}", fileName);
            throw;
        }
    }

    private async Task<MediaInfo?> DetectMovieAsync(string fileName)
    {
        var match = MoviePattern.Match(fileName);
        if (!match.Success)
        {
            _logger.LogDebug("Filename does not match movie pattern: {FileName}", fileName);
            return null;
        }

        var title = match.Groups["title"].Value.Replace(".", " ").Trim();
        var yearStr = match.Groups["year"].Value;
        var year = int.Parse(yearStr);

        _logger.LogDebug("Detected movie pattern - Title: {Title}, Year: {Year}", title, year);

        var searchResults = await _tmdbClient.SearchMovieAsync(title);
        var bestMatch = searchResults.Results
            .Where(m => m.ReleaseDate?.Year == year)
            .MaxBy(m => m.Popularity);

        if (bestMatch == null)
        {
            _logger.LogWarning("No TMDb match found for movie: {Title} ({Year})", title, year);
            return null;
        }

        return new MediaInfo
        {
            Title = bestMatch.Title,
            Year = bestMatch.ReleaseDate?.Year,
            TmdbId = bestMatch.Id,
            MediaType = MediaType.Movies
        };
    }

    private async Task<MediaInfo?> DetectTvShowAsync(string fileName)
    {
        var match = TvShowPattern.Match(fileName);
        if (!match.Success)
        {
            _logger.LogDebug("Filename does not match TV show pattern: {FileName}", fileName);
            return null;
        }

        var title = match.Groups["title"].Value.Replace(".", " ").Trim();
        var season = int.Parse(match.Groups["season"].Value);
        var episode = int.Parse(match.Groups["episode"].Value);

        _logger.LogDebug("Detected TV show pattern - Title: {Title}, S{Season:D2}E{Episode:D2}", 
            title, season, episode);

        var searchResults = await _tmdbClient.SearchTvShowAsync(title);
        var bestMatch = searchResults.Results.MaxBy(s => s.Popularity);

        if (bestMatch == null)
        {
            _logger.LogWarning("No TMDb match found for TV show: {Title}", title);
            return null;
        } 

        var episodeInfo = await _tmdbClient.GetTvEpisodeAsync(bestMatch.Id, season, episode);

        return new MediaInfo
        {
            Title = bestMatch.Name,
            Year = bestMatch.FirstAirDate?.Year,
            TmdbId = bestMatch.Id,
            MediaType = MediaType.TvShows,
            SeasonNumber = season,
            EpisodeNumber = episode,
            EpisodeTitle = episodeInfo?.Name
        };
    }

    [GeneratedRegex("^(?<title>.+?)[\\. \\[]?(?<year>\\d{4}).*\\.(mkv|mp4|avi)$", RegexOptions.IgnoreCase | RegexOptions.Compiled, "en-DE")]
    private static partial Regex MyRegex();
    [GeneratedRegex("^(?<title>.+?)[\\. \\[]?[sS](?<season>\\d{1,2})[eE](?<episode>\\d{1,2}).*\\.(mkv|mp4|avi)$", RegexOptions.IgnoreCase | RegexOptions.Compiled, "en-DE")]
    private static partial Regex MyRegex1();
} 