using System.Text.RegularExpressions;

namespace PlexLocalScan.Shared.Services;

public abstract partial class RegexTv
{
    [GeneratedRegex(@"^(?<title>.+?)[\. \[]?[Ss](?<season>\d{1,2})[\. \[]?[eE](?<episode>\d{1,2})?[-]?(?:[-eE](?<episode2>\d{1,2}))?.*\.(mkv|mp4|avi)$", RegexOptions.IgnoreCase | RegexOptions.Compiled, "en-EN")]
    public static partial Regex MyRegex();

    [GeneratedRegex(@"^(?<title>.+?)(?:\s\(?(?<year>\d{4})\)?)?\s?[-\s]*$", RegexOptions.IgnoreCase | RegexOptions.Compiled, "en-EN")]
    public static partial Regex MyRegex1();
}