using PlexLocalScan.Core.Media;

namespace PlexLocalScan.Shared.Symlinks.Services;

public static class PathFormatHelper
{
    public static (string folderPath, string fileName) FormatMoviePath(MediaInfo? mediaInfo)
    {
        ArgumentNullException.ThrowIfNull(mediaInfo);

        if (string.IsNullOrEmpty(mediaInfo.Title) || !mediaInfo.Year.HasValue)
        {
            throw new ArgumentException("Movie title and year are required");
        }

        var movieFolder = $"{CleanFileName(mediaInfo.Title)} ({mediaInfo.Year})";
        var movieFileName =
            $"{CleanFileName(mediaInfo.Title)} ({mediaInfo.Year}) {{imdb-{mediaInfo.ImdbId}}}";
        return (movieFolder, movieFileName);
    }

    public static (string folderPath, string fileName) FormatTvShowPath(MediaInfo? mediaInfo)
    {
        ArgumentNullException.ThrowIfNull(mediaInfo);

        if (
            string.IsNullOrEmpty(mediaInfo.Title)
            || !mediaInfo.SeasonNumber.HasValue
            || !mediaInfo.EpisodeNumber.HasValue
            || !mediaInfo.Year.HasValue
        )
        {
            throw new ArgumentException("TV show title, season, episode, and year are required");
        }

        var showFolder = $"{CleanFileName(mediaInfo.Title)} ({mediaInfo.Year})";
        var seasonFolder = $"Season {mediaInfo.SeasonNumber:D2}";
        var fileName =
            $"{CleanFileName(mediaInfo.Title)} - S{mediaInfo.SeasonNumber:D2}E{mediaInfo.EpisodeNumber:D2}";

        if (mediaInfo.EpisodeNumber2.HasValue)
        {
            fileName += $"E{mediaInfo.EpisodeNumber2:D2}";
        }

        if (!string.IsNullOrEmpty(mediaInfo.EpisodeTitle))
        {
            fileName += $" - {CleanFileName(mediaInfo.EpisodeTitle)}";
        }

        return (Path.Combine(showFolder, seasonFolder), fileName);
    }

    private static string CleanFileName(string fileName)
    {
        var invalid = Path.GetInvalidFileNameChars();
        return string.Join("", fileName.Select(c => invalid.Contains(c) ? " -" : c.ToString()))
            .Replace("  ", " ", StringComparison.Ordinal) // Remove any double spaces that might occur
            .Trim();
    }
}
