using System.Text.RegularExpressions;

namespace PlexLocalScan.Shared.MediaDetection.Options;


internal static partial class RegexTv
{
    private const string BasicSeasonEpisodeRegexPattern = @"^(?<title>.*?)[\. ]?[s](?<season>\d{1,2})[\. ]?(e|ep)(?<episode>\d{1,2})[-]?(?<episode2>(e|ep)?\d{1,2})?.*$";
    private const string FinerTitleRegexPattern = @"^(?<title>.+?)(?:\s\(?(?<year>\d{4})\)?)?\s?[-\s]*$";

    
    [GeneratedRegex(BasicSeasonEpisodeRegexPattern, RegexOptions.IgnoreCase | RegexOptions.Compiled, "en-EN")]
    private static partial Regex GeneratedBasicSeasonEpisodeRegex();

    [GeneratedRegex(FinerTitleRegexPattern, RegexOptions.IgnoreCase | RegexOptions.Compiled, "en-EN")]
    private static partial Regex GeneratedFinerTitleRegex();


    public static readonly Regex BasicSeasonEpisodeRegex = GeneratedBasicSeasonEpisodeRegex();
    public static readonly Regex FinerTitleRegex = GeneratedFinerTitleRegex();
};
