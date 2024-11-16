using PlexLocalScan.Shared.Interfaces;

namespace PlexLocalScan.Shared.Services;

public class DateTimeProvider : IDateTimeProvider
{
    public DateTime Now => DateTime.Now;
} 