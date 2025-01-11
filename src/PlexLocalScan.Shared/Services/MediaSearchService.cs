using PlexLocalScan.Shared.Interfaces;
using Microsoft.Extensions.Logging;
using PlexLocalScan.Core.Media;
using PlexLocalScan.Core.Series;
using PlexLocalScan.Core.Tables;
using PlexLocalScan.Data.Data;

namespace PlexLocalScan.Shared.Services;

public record MediaSearchResult(int TmdbId, string Title, int? Year, string? PosterPath);

public class MediaSearchService(ITmDbClientWrapper tmdbClient, ILogger<MediaSearchService> logger, PlexScanContext dbContext) : IMediaSearchService
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
        
        if (searchResults == null)
        {
            logger.LogWarning("SearchTvShowAsync returned null");
            return [];
        }

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
        TMDbLib.Objects.Movies.Movie movie = await tmdbClient.GetMovieAsync(tmdbId);
        if (movie != null)
        {
            var mediaInfo = new MediaInfo
            {
                Title = movie.Title,
                Year = movie.ReleaseDate?.Year,
                TmdbId = movie.Id,
                MediaType = MediaType.Movies,
                PosterPath = movie.PosterPath,
                Summary = movie.Overview,
                Status = movie.Status
            };
            return mediaInfo;
        }
        return null;
    }

    public async Task<MediaInfo?> GetTvShowMediaInfoAsync(int tmdbId, bool includeDetails = false)
    {
        TMDbLib.Objects.TvShows.TvShow tvShow = await tmdbClient.GetTvShowAsync(tmdbId);
        if (tvShow == null)
        {
            return null;
        }

        // Get episodes and seasons from database
        var episodesScannedFiles = dbContext.ScannedFiles
            .Where(f => f.TmdbId == tmdbId && f.MediaType == MediaType.TvShows)
            .OrderBy(e => e.SeasonNumber)
            .ToList();

        int episodeCount = tvShow.NumberOfEpisodes;
        int episodeCountScanned = episodesScannedFiles.Count(e => e.Status == FileStatus.Success);

        return new MediaInfo
        {
            Title = tvShow.Name,
            Year = tvShow.FirstAirDate?.Year,
            TmdbId = tvShow.Id,
            MediaType = MediaType.TvShows,
            PosterPath = tvShow.PosterPath,
            Summary = tvShow.Overview,
            Status = tvShow.Status,
            Genres = tvShow.Genres.Select(g => g.Name).ToList().AsReadOnly(),
            EpisodeCount = episodeCount,
            EpisodeCountScanned = episodeCountScanned
        };
    }

    public async Task<SeasonInfo?> GetTvShowSeasonMediaInfoAsync(int tmdbId, int seasonNumber, bool includeDetails = false)
    {
        TMDbLib.Objects.TvShows.TvSeason season = await tmdbClient.GetTvSeasonAsync(tmdbId, seasonNumber);
        if (season != null)
        {
            var episodes = new List<EpisodeInfo>();
            if (includeDetails)
            {
                foreach (TMDbLib.Objects.Search.TvSeasonEpisode? episode in season.Episodes)
                {
                    EpisodeInfo? episodeInfo = await GetTvShowEpisodeMediaInfoAsync(tmdbId, seasonNumber, episode.EpisodeNumber, includeDetails);
                    if (episodeInfo != null)
                    {
                        episodes.Add(episodeInfo);
                    }
                }
            }

            return new SeasonInfo
            {
                SeasonNumber = season.SeasonNumber,
                Name = includeDetails ? season.Name : null,
                Overview = includeDetails ? season.Overview : null,
                PosterPath = includeDetails ? season.PosterPath : null,
                AirDate = includeDetails ? season.AirDate : null,
                Episodes = episodes.AsReadOnly()
            };
        }
        return null;
    }

    public async Task<EpisodeInfo?> GetTvShowEpisodeMediaInfoAsync(int tmdbId, int seasonNumber, int episodeNumber, bool includeDetails = false)
    {
        TMDbLib.Objects.TvShows.TvEpisode episode = await tmdbClient.GetTvEpisodeAsync(tmdbId, seasonNumber, episodeNumber);
        if (episode == null)
        {
            return null;
        }

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
        return episodeInfo;
    }

    public async Task<string?> GetImageUrlAsync(string path, string size) => await tmdbClient.GetImageUrl(path, size);
}
