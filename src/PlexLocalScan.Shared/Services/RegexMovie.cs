using System.Text.RegularExpressions;

namespace PlexLocalScan.Shared.Services;

internal static partial class RegexMovie
{
    private const string BasicMovieRegexPattern = @"^(?<title>.+?)\s*(?:\((?<year>\d{4})\)|(?<year>\d{4}))(?:\..+)?$";
    
    [GeneratedRegex(BasicMovieRegexPattern, RegexOptions.IgnoreCase | RegexOptions.Compiled, "en-EN")]
    private static partial Regex GeneratedBasicMovieRegex();
    public static readonly Regex BasicMovieRegex = GeneratedBasicMovieRegex();


}
