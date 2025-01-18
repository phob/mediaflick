using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using NSubstitute;
using PlexLocalScan.Core.Media;
using PlexLocalScan.Shared.Configuration.Options;
using PlexLocalScan.Shared.MediaDetection.Services;
using PlexLocalScan.Shared.TmDbMediaSearch.Interfaces;
using TMDbLib.Objects.TvShows;
using TMDbLib.Objects.Search;
using TMDbLib.Objects.General;
using MediaType = PlexLocalScan.Core.Tables.MediaType;

namespace PlexLocalScan.Test.Services;

#pragma warning disable CA1515
public sealed record TvShowTestData(string FileName, string Title, int Season, int Episode, int TmdbId, string ImdbId, int Year, DateTime ReleaseDate, double Popularity)
{
    public static IEnumerable<object[]> ValidTvShows =>
        [
            [
                new TvShowTestData(
                    "The.Last.of.Us.S01E01.1080p.mkv",
                    "The Last of Us",
                    1,
                    1,
                    100088,
                    "tt3581920",
                    2023,
                    new DateTime(2023, 1, 15, 0, 0, 0, DateTimeKind.Utc),
                    1000.0)
            ],
            [
                new TvShowTestData(
                    "Breaking.Bad.S05E03.1080p.mkv",
                    "Breaking Bad",
                    5,
                    3,
                    1396,
                    "tt0903747",
                    2008,
                    new DateTime(2008, 1, 20, 0, 0, 0, DateTimeKind.Utc),
                    900.0)
            ]
        ];
}

public class TvDetectionServiceTests
{
    private readonly ITmDbClientWrapper _tmDbClient;
    private readonly IMemoryCache _cache;
    private readonly TvShowDetectionService _sut;

    public TvDetectionServiceTests()
    {
        _tmDbClient = Substitute.For<ITmDbClientWrapper>();
        _cache = Substitute.For<IMemoryCache>();
        var logger = Substitute.For<ILogger<TvShowDetectionService>>();
        var options = Substitute.For<IOptionsSnapshot<MediaDetectionOptions>>();
        options.Value.Returns(new MediaDetectionOptions { CacheDuration = 60 * 30 });

        _sut = new TvShowDetectionService(logger, _tmDbClient, _cache, options);
    }

    [Theory]
    [MemberData(nameof(TvShowTestData.ValidTvShows), MemberType = typeof(TvShowTestData))]
    public async Task DetectTvShowAsyncWithValidFileNameReturnsMediaInfo(TvShowTestData testData)
    {
        // Arrange
        var filePath = Path.Combine(@"D:\TV Shows", testData.FileName);

        var searchContainer = new SearchContainer<SearchTv>
        {
            Results =
            [
                new SearchTv { Id = testData.TmdbId, Name = testData.Title, FirstAirDate = testData.ReleaseDate, Popularity = testData.Popularity }
            ]
        };
        
        _tmDbClient.SearchTvShowAsync(testData.Title).Returns(Task.FromResult(searchContainer));
        _tmDbClient.GetTvShowAsync(testData.TmdbId).Returns(Task.FromResult(new TvShow { Id = testData.TmdbId }));
        _tmDbClient.GetTvEpisodeAsync(testData.TmdbId, testData.Season, testData.Episode).Returns(Task.FromResult(new TvEpisode { Id = 1, SeasonNumber = testData.Season, EpisodeNumber = testData.Episode }));
        _tmDbClient.GetTvShowExternalIdsAsync(testData.TmdbId).Returns(Task.FromResult(new ExternalIdsTvShow { ImdbId = testData.ImdbId }));
        // Act
        var result = await _sut.DetectTvShowAsync(testData.FileName, filePath);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(testData.Title, result.Title);
        Assert.Equal(testData.Season, result.SeasonNumber);
        Assert.Equal(testData.Episode, result.EpisodeNumber);
        Assert.Equal(testData.TmdbId, result.TmdbId);
        Assert.Equal(testData.ImdbId, result.ImdbId);
        Assert.Equal(testData.Year, result.Year);
        Assert.Equal(MediaType.TvShows, result.MediaType);
    }

    [Fact]
    public async Task DetectTvShowAsyncWithInvalidFileNameReturnsEmptyMediaInfo()
    {
        // Arrange
        const string invalidFileName = "invalid.file.name.mkv";
        var filePath = Path.Combine(@"D:\TV Shows", invalidFileName);
        _tmDbClient.SearchTvShowAsync(Arg.Any<string>()).Returns(Task.FromResult(new SearchContainer<SearchTv> { Results = [] }));

        // Act
        var result = await _sut.DetectTvShowAsync(invalidFileName, filePath);

        // Assert
        Assert.NotNull(result);
        Assert.Null(result.Title);
        Assert.Null(result.TmdbId);
        Assert.Null(result.ImdbId);
        Assert.Null(result.Year);
        Assert.Equal(MediaType.TvShows, result.MediaType);
    }

    [Fact]
    public async Task DetectTvShowAsyncWhenCachedReturnsCachedResult()
    {
        // Arrange
        var fileName = "The.Last.of.Us.S01E01.1080p.mkv";
        var filePath = Path.Combine(@"D:\TV Shows", fileName);
        var cachedMediaInfo = new MediaInfo
        {
            Title = "The Last of Us",
            TmdbId = 100088,
            ImdbId = "tt3581920",
            Year = 2023,
            MediaType = MediaType.TvShows
        };

        _cache.TryGetValue(Arg.Any<string>(), out MediaInfo? _)
            .Returns(x =>
            {
                x[1] = cachedMediaInfo;
                return true;
            });

        // Act
        var result = await _sut.DetectTvShowAsync(fileName, filePath);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(cachedMediaInfo.Title, result.Title);
        Assert.Equal(cachedMediaInfo.TmdbId, result.TmdbId);
        Assert.Equal(cachedMediaInfo.ImdbId, result.ImdbId);
        Assert.Equal(cachedMediaInfo.Year, result.Year);
        Assert.Equal(cachedMediaInfo.MediaType, result.MediaType);
    }

    [Theory]
    [MemberData(nameof(TvShowTestData.ValidTvShows), MemberType = typeof(TvShowTestData))]
    public async Task DetectTvShowByTmdbIdAsyncWithValidIdReturnsCorrectInfo(TvShowTestData testData)
    {
        // Arrange
        var tvShow = new TvShow
        {
            Id = testData.TmdbId,
            Name = testData.Title,
            FirstAirDate = testData.ReleaseDate
        };

        var episode = new TvEpisode
        {
            Id = 1,
            Name = "Pilot",
            SeasonNumber = 1,
            EpisodeNumber = 1
        };

        var externalIds = new ExternalIdsTvShow
        {
            ImdbId = testData.ImdbId
        };

        _tmDbClient.GetTvShowAsync(testData.TmdbId).Returns(Task.FromResult(tvShow));
        _tmDbClient.GetTvEpisodeAsync(testData.TmdbId, 1, 1).Returns(Task.FromResult(episode));
        _tmDbClient.GetTvShowExternalIdsAsync(testData.TmdbId).Returns(Task.FromResult(externalIds));

        // Act
        var result = await _sut.DetectTvShowByTmdbIdAsync(testData.TmdbId, 1, 1);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(testData.Title, result.Title);
        Assert.Equal(testData.TmdbId, result.TmdbId);
        Assert.Equal(testData.ImdbId, result.ImdbId);
        Assert.Equal(testData.Year, result.Year);
        Assert.Equal(MediaType.TvShows, result.MediaType);
    }

    [Fact]
    public async Task DetectTvShowByTmdbIdAsyncWithInvalidIdReturnsEmptyMediaInfo()
    {
        // Arrange
        var invalidTmdbId = -1;
        _tmDbClient.GetTvShowAsync(invalidTmdbId).Returns(Task.FromException<TvShow>(new HttpRequestException("Invalid TMDb ID")));

        // Act
        var result = await _sut.DetectTvShowByTmdbIdAsync(invalidTmdbId, 1, 1);

        // Assert
        Assert.NotNull(result);
        Assert.Null(result.Title);
        Assert.Null(result.TmdbId);
        Assert.Null(result.ImdbId);
        Assert.Null(result.Year);
    }
}
