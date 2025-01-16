namespace PlexLocalScan.Shared.Options;

public class MediaDetectionOptions
{
    public TimeSpan CacheDuration { get; set; } = TimeSpan.FromHours(24);
}
