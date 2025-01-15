namespace PlexLocalScan.Data.Data;

public class MediaDetectionDbOptions
{
    public int Id { get; set; }
    public TimeSpan CacheDuration => TimeSpan.FromSeconds(CacheDurationSeconds);
    public int CacheDurationSeconds { get; set; }
}
