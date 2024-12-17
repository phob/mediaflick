using PlexLocalScan.Data.Models;
using PlexLocalScan.Shared.Interfaces;
using Microsoft.Extensions.Logging;
using PlexLocalScan.Shared.Models.Media;

namespace PlexLocalScan.Shared.Services;

public record MediaSearchResult(int TmdbId, string Title, int? Year);

public class MediaLookupService(ITMDbClientWrapper tmdbClient, ILogger<MediaLookupService> logger) : IMediaLookupService
{
    public async Task<IEnumerable<MediaSearchResult>> SearchMovieTmdbIdsAsync(string title)
    {
        var searchResults = await tmdbClient.SearchMovieAsync(title);
        return searchResults.Results.Select(r => new MediaSearchResult(r.Id, r.Title, r.ReleaseDate?.Year)).ToList();
    }

    public async Task<IEnumerable<MediaSearchResult>> SearchTvShowTmdbIdsAsync(string title)
    {
        logger.LogInformation("Searching for TV show with title: {Title}", title);
        var searchResults = await tmdbClient.SearchTvShowAsync(title);
        
        if (searchResults == null)
        {
            logger.LogWarning("SearchTvShowAsync returned null");
            return Enumerable.Empty<MediaSearchResult>();
        }

        if (searchResults.Results == null)
        {
            logger.LogWarning("SearchTvShowAsync results collection is null");
            return Enumerable.Empty<MediaSearchResult>();
        }

        var results = searchResults.Results.Select(r => new MediaSearchResult(r.Id, r.Name, r.FirstAirDate?.Year)).ToList();
        logger.LogInformation("Found {Count} TV show results", results.Count);
        
        return results;
    }

    public async Task<MediaInfo?> GetMovieMediaInfoAsync(int tmdbId)
    {
        var movie = await tmdbClient.GetMovieAsync(tmdbId);
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

    public async Task<MediaInfo?> GetTvShowMediaInfoAsync(int tmdbId)
    {
        var tvShow = await tmdbClient.GetTvShowAsync(tmdbId);
        if (tvShow == null) return null;

        // Fetch all seasons in parallel
        var seasonTasks = tvShow.Seasons
            .Select(season => tmdbClient.GetTvSeasonAsync(tmdbId, season.SeasonNumber))
            .ToList();

        var seasons = await Task.WhenAll(seasonTasks);

        var seasonsList = seasons
            .Where(season => season != null)
            .Select(season => new SeasonInfo
            {
                SeasonNumber = season!.SeasonNumber,
                Name = season.Name,
                Overview = season.Overview,
                PosterPath = season.PosterPath,
                AirDate = season.AirDate,
                Episodes = season.Episodes.Select(episode => new EpisodeInfo
                {
                    EpisodeNumber = episode.EpisodeNumber,
                    Name = episode.Name,
                    Overview = episode.Overview,
                    StillPath = episode.StillPath,
                    AirDate = episode.AirDate,
                    TmdbId = episode.Id
                }).ToList()
            })
            .ToList();

        return new MediaInfo
        {
            Title = tvShow.Name,
            Year = tvShow.FirstAirDate?.Year,
            TmdbId = tvShow.Id,
            MediaType = MediaType.TvShows,
            PosterPath = tvShow.PosterPath,
            Summary = tvShow.Overview,
            Status = tvShow.Status,
            Seasons = seasonsList
        };
    }

    public async Task<SeasonInfo?> GetTvShowSeasonMediaInfoAsync(int tmdbId, int seasonNumber)
    {
        var season = await tmdbClient.GetTvSeasonAsync(tmdbId, seasonNumber);
        if (season != null)
        {
            var seasonInfo = new SeasonInfo
            {
                SeasonNumber = season.SeasonNumber,
                Name = season.Name,
                Overview = season.Overview,
                PosterPath = season.PosterPath,
                AirDate = season.AirDate,
                Episodes = []
            };

            foreach (var episode in season.Episodes)
            {
                var episodeInfo = await GetTvShowEpisodeMediaInfoAsync(tmdbId, seasonNumber, episode.EpisodeNumber);
                if (episodeInfo != null)
                {
                    seasonInfo.Episodes.Add(episodeInfo);
                }
            }

            return seasonInfo;
        }
        return null;
    }

    public async Task<EpisodeInfo?> GetTvShowEpisodeMediaInfoAsync(int tmdbId, int seasonNumber, int episodeNumber)
    {
        var episode = await tmdbClient.GetTvEpisodeAsync(tmdbId, seasonNumber, episodeNumber);
        if (episode != null)
        {
            return new EpisodeInfo
            {
                EpisodeNumber = episode.EpisodeNumber,
                Name = episode.Name,
                Overview = episode.Overview,
                StillPath = episode.StillPath,
                AirDate = episode.AirDate,
                TmdbId = episode.Id
            };
        }
        return null;
    }

    public async Task<string?> GetImageUrlAsync(string path, string size)
    {
        return await tmdbClient.GetImageUrl(path, size);
    }
}