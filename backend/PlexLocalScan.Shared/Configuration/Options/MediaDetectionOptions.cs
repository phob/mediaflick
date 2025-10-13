namespace PlexLocalScan.Shared.Configuration.Options;

// 60 * 60 * 24 = 86400 seconds
// 100 * 1024 * 1024 = 104857600 bytes (100 MB)
public class MediaDetectionOptions
{
    public int CacheDuration { get; set; } = 86400;
    public long AutoExtrasThresholdBytes { get; set; } = 104857600;
}
