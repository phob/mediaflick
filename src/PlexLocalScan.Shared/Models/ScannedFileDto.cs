using PlexLocalScan.Data.Models;

namespace PlexLocalScan.Shared.Models;

public class ScannedFileDto
{
    public int Id { get; init; }
    public string SourceFile { get; init; } = string.Empty;
    public string? DestFile { get; set; }
    public string? MediaType { get; set; }
    public int? TmdbId { get; set; }
    public string? ImdbId { get; set; }
    public string? Title { get; set; }
    public int? Year { get; set; }
    public List<string>? Genres { get; set; }
    public int? SeasonNumber { get; set; }
    public int? EpisodeNumber { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; init; }
    public DateTime? UpdatedAt { get; set; }
    public int VersionUpdated { get; set; }
    public int UpdateToVersion { get; set; }

    private const string GENRE_SEPARATOR = "|";
    
    public static IEnumerable<string>? ConvertStringToGenres(string? genresString)
        => !string.IsNullOrWhiteSpace(genresString) 
            ? genresString.Split(GENRE_SEPARATOR, StringSplitOptions.RemoveEmptyEntries) 
            : null;
    public static string? ConvertGenresToString(IEnumerable<string>? genres)
        => genres?.Any() == true ? string.Join(GENRE_SEPARATOR, genres) : null;

    public static ScannedFileDto FromScannedFile(ScannedFile file)
    {
        return new ScannedFileDto
        {
            Id = file.Id,
            SourceFile = file.SourceFile,
            DestFile = file.DestFile,
            MediaType = file.MediaType?.ToString(),
            TmdbId = file.TmdbId,
            ImdbId = file.ImdbId,
            Title = file.Title,
            Year = file.Year,
            Genres = ConvertStringToGenres(file.Genres)?.ToList(),
            SeasonNumber = file.SeasonNumber,
            EpisodeNumber = file.EpisodeNumber,
            Status = file.Status.ToString(),
            CreatedAt = file.CreatedAt,
            UpdatedAt = file.UpdatedAt,
            VersionUpdated = file.VersionUpdated,
            UpdateToVersion = file.UpdateToVersion
        };
    }
} 