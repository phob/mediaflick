using PlexLocalScan.Core.Media;
using PlexLocalScan.Core.Series;
using PlexLocalScan.Shared.TmDbMediaSearch.Services;

namespace PlexLocalScan.Shared.TmDbMediaSearch.Interfaces;

public interface IMediaSearchService
{
    Task<IEnumerable<MediaSearchResult>> SearchMovieTmdbIdsAsync(string title);
    Task<IEnumerable<MediaSearchResult>> SearchTvShowTmdbIdsAsync(string title);
    Task<MediaInfo?> GetMovieMediaInfoAsync(int tmdbId);
    Task<MediaInfo?> GetTvShowMediaInfoAsync(int tmdbId, bool includeDetails = false);
    Task<SeasonInfo?> GetTvShowSeasonMediaInfoAsync(
        int tmdbId,
        int seasonNumber,
        bool includeDetails = false
    );
    Task<EpisodeInfo?> GetTvShowEpisodeMediaInfoAsync(
        int tmdbId,
        int seasonNumber,
        int episodeNumber,
        bool includeDetails = false
    );
    Task<string?> GetImageUrlAsync(string path, string size);
}
