using PlexLocalScan.Core.Media;
using PlexLocalScan.Core.Series;
using PlexLocalScan.Shared.Services;

namespace PlexLocalScan.Shared.Interfaces;

public interface IMediaLookupService
{
    Task<IEnumerable<MediaSearchResult>> SearchMovieTmdbIdsAsync(string title);
    Task<IEnumerable<MediaSearchResult>> SearchTvShowTmdbIdsAsync(string title);
    Task<MediaInfo?> GetMovieMediaInfoAsync(int tmdbId);
    Task<MediaInfo?> GetTvShowMediaInfoAsync(int tmdbId);
    Task<SeasonInfo?> GetTvShowSeasonMediaInfoAsync(int tmdbId, int seasonNumber);
    Task<EpisodeInfo?> GetTvShowEpisodeMediaInfoAsync(int tmdbId, int seasonNumber, int episodeNumber);
    Task<string?> GetImageUrlAsync(string path, string size);
}