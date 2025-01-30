using System.Collections.ObjectModel;

namespace PlexLocalScan.Core.Tables;

public class ScannedFileDto
{
    public int Id { get; init; }
    public string SourceFile { get; init; } = string.Empty;
    public string? DestFile { get; init; }
    public string? MediaType { get; init; }
    public int? TmdbId { get; init; }
    public string? ImdbId { get; init; }
    public string? Title { get; init; }
    public int? Year { get; init; }
    public Collection<string>? Genres { get; init; }
    public int? SeasonNumber { get; init; }
    public int? EpisodeNumber { get; init; }
    public string Status { get; init; } = string.Empty;
    public DateTime CreatedAt { get; init; }
    public DateTime? UpdatedAt { get; init; }
    public int VersionUpdated { get; init; }
    public int UpdateToVersion { get; init; }

    private const string GenreSeparator = "|";

    public static IEnumerable<string>? ConvertStringToGenres(string? genresString) =>
        !string.IsNullOrWhiteSpace(genresString)
            ? genresString.Split(GenreSeparator, StringSplitOptions.RemoveEmptyEntries)
            : null;

    public static string? ConvertGenresToString(IEnumerable<string>? genres)
    {
        if (genres == null)
        {
            return null;
        }

        var enumerable = genres as string[] ?? [.. genres];
        return enumerable.Length != 0 ? string.Join(GenreSeparator, enumerable) : null;
    }

    public static ScannedFileDto FromScannedFile(ScannedFile file) =>
        new()
        {
            Id = file.Id,
            SourceFile = file.SourceFile,
            DestFile = file.DestFile,
            MediaType = file.MediaType?.ToString(),
            TmdbId = file.TmdbId,
            ImdbId = file.ImdbId,
            Title = file.Title,
            Year = file.Year,
            Genres = ConvertStringToGenres(file.Genres) is IEnumerable<string> genres
                ? new Collection<string>(genres.ToList())
                : null,
            SeasonNumber = file.SeasonNumber,
            EpisodeNumber = file.EpisodeNumber,
            Status = file.Status.ToString(),
            CreatedAt = file.CreatedAt,
            UpdatedAt = file.UpdatedAt,
            VersionUpdated = file.VersionUpdated,
            UpdateToVersion = file.UpdateToVersion,
        };
}
