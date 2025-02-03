namespace PlexLocalScan.Shared.Configuration.Options;

// 60 * 60 * 24 = 86400 seconds
public class MediaDetectionOptions
{
    public int CacheDuration { get; set; } = 86400;
}
