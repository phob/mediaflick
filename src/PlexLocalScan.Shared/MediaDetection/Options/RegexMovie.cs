using System.Text.RegularExpressions;

namespace PlexLocalScan.Shared.MediaDetection.Options;

internal static partial class RegexMovie
{
    private const string BasicMovieRegexPattern =
        @"^(?<title>.*?(?:\d{4})?.*?)\s+(?:\((?<year>(?:19|20)\d{2})\)|(?<year>(?:19|20)\d{2}))(?:\s.*)?$";

    [GeneratedRegex(
        BasicMovieRegexPattern,
        RegexOptions.IgnoreCase | RegexOptions.Compiled,
        "en-EN"
    )]
    private static partial Regex GeneratedBasicMovieRegex();

    public static readonly Regex BasicMovieRegex = GeneratedBasicMovieRegex();
}
