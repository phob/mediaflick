namespace PlexLocalscan.Services;

public static class PathFormatHelper
{
    public static string FormatMoviePath(MediaInfo mediaInfo)
    {
        if (string.IsNullOrEmpty(mediaInfo.Title) || !mediaInfo.Year.HasValue)
            throw new ArgumentException("Movie title and year are required");

        return $"{CleanFileName(mediaInfo.Title)} ({mediaInfo.Year})";
    }

    public static (string folderPath, string fileName) FormatTvShowPath(MediaInfo mediaInfo)
    {
        if (string.IsNullOrEmpty(mediaInfo.Title) || !mediaInfo.SeasonNumber.HasValue || !mediaInfo.EpisodeNumber.HasValue)
            throw new ArgumentException("TV show title, season, and episode are required");

        var showFolder = CleanFileName(mediaInfo.Title);
        var seasonFolder = $"Season {mediaInfo.SeasonNumber:D2}";
        var fileName = $"{CleanFileName(mediaInfo.Title)} - S{mediaInfo.SeasonNumber:D2}E{mediaInfo.EpisodeNumber:D2}";
        
        if (!string.IsNullOrEmpty(mediaInfo.EpisodeTitle))
        {
            fileName += $" - {CleanFileName(mediaInfo.EpisodeTitle)}";
        }

        return (Path.Combine(showFolder, seasonFolder), fileName);
    }

    private static string CleanFileName(string fileName)
    {
        var invalid = Path.GetInvalidFileNameChars();
        return string.Join("", fileName.Select(c => invalid.Contains(c) ? '_' : c)).Trim();
    }
} 