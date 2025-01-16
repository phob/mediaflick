namespace PlexLocalScan.Shared.Options;

public class MediaDetectionOptions
{
    public string MoviePattern { get; set; } = @"^(?<title>.+?)[\. \[]?(?<year>\d{4}).*\.(mkv|mp4|avi)$";
    public string TvShowPattern { get; set; } = @"^(?<title>.+?)[\. \[]?[Ss](?<season>\d{1,2})[\. \[]?[eE](?<episode>\d{1,2})?[-]?(?:[-eE](?<episode2>\d{1,2}))?.*\.(mkv|mp4|avi)$";
    public string TitleCleanupPattern { get; set; } = @"^(?<title>.+?)(?:\s\(?(?<year>\d{4})\)?)?\s?[-\s]*$";
    public TimeSpan CacheDurationSeconds { get; set; } = TimeSpan.FromSeconds(86400);
}
