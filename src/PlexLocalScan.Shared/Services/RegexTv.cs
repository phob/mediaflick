using System.Text.RegularExpressions;

namespace PlexLocalScan.Shared.Services;


internal static partial class RegexTv
{
    private const string BasicSeasonEpisodeRegexPattern = @"^(?<title>.+?)[\. \[]?[Ss](?<season>\d{1,2})[\. \[]?[eE](?<episode>\d{1,2})?[-]?(?:[-eE](?<episode2>\d{1,2}))?.*\.(mkv|mp4|avi)$";
    private const string FinerTitleRegexPattern = @"^(?<title>.+?)(?:\s\(?(?<year>\d{4})\)?)?\s?[-\s]*$";
    
    [GeneratedRegex(BasicSeasonEpisodeRegexPattern, RegexOptions.IgnoreCase | RegexOptions.Compiled, "en-EN")]
    private static partial Regex GeneratedBasicSeasonEpisodeRegex();

    [GeneratedRegex(FinerTitleRegexPattern, RegexOptions.IgnoreCase | RegexOptions.Compiled, "en-EN")]
    private static partial Regex GeneratedFinerTitleRegex();

    public static readonly Regex BasicSeasonEpisodeRegex = GeneratedBasicSeasonEpisodeRegex();
    public static readonly Regex FinerTitleRegex = GeneratedFinerTitleRegex();
};
