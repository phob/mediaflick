using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Caching.Memory;
using NSubstitute;
using PlexLocalScan.Core.Media;
using PlexLocalScan.Shared.Interfaces;
using PlexLocalScan.Shared.Options;
using PlexLocalScan.Shared.Services;
using TMDbLib.Objects.General;
using TMDbLib.Objects.Search;
using MediaType = PlexLocalScan.Core.Tables.MediaType;

namespace PlexLocalScan.Test.Services;
#pragma warning disable CA1515
public sealed record MovieTestData
#pragma warning restore CA1515
{
    public required string FileName { get; init; }
    public required string Title { get; init; }
    public required int TmdbId { get; init; }
    public required string ImdbId { get; init; }
    public required int Year { get; init; }
    public required DateTime ReleaseDate { get; init; }
    public double Popularity { get; init; } = 90.0;
}

public class MovieDetectionServiceTests
{
    private readonly ITmDbClientWrapper _tmdbClient;
    private readonly IMemoryCache _cache;
    private readonly MovieDetectionService _service;

    public MovieDetectionServiceTests()
    {
        var logger = Substitute.For<ILogger<MovieDetectionService>>();
        _tmdbClient = Substitute.For<ITmDbClientWrapper>();
        _cache = Substitute.For<IMemoryCache>();
        var options = Options.Create(new MediaDetectionOptions { CacheDuration = TimeSpan.FromMinutes(30) });

        // Setup cache mock to accept any Set operations
        var cacheEntry = Substitute.For<ICacheEntry>();
        _cache.CreateEntry(Arg.Any<object>()).Returns(cacheEntry);

        _service = new MovieDetectionService(
            logger,
            _tmdbClient,
            _cache,
            options
        );
    }

    [Theory]
    [MemberData(nameof(MovieTestData))]
    public async Task DetectMovieAsyncWithValidMoviesReturnsCorrectInfo(MovieTestData testData)
    {
        // Arrange
        var filePath = Path.Combine(@"D:\Movies", testData.FileName);
        var searchContainer = new SearchContainer<SearchMovie>
        {
            Results =
            [
                new SearchMovie
                {
                    Id = testData.TmdbId,
                    Title = testData.Title,
                    ReleaseDate = testData.ReleaseDate,
                    Popularity = testData.Popularity
                }
            ]
        };

        var externalIds = new ExternalIdsMovie { ImdbId = testData.ImdbId };

        _tmdbClient.SearchMovieAsync(testData.Title).Returns(searchContainer);
        _tmdbClient.GetMovieExternalIdsAsync(testData.TmdbId).Returns(externalIds);

        // Act
        var result = await _service.DetectMovieAsync(testData.FileName, filePath);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(testData.Title, result.Title);
        Assert.Equal(testData.Year, result.Year);
        Assert.Equal(testData.TmdbId, result.TmdbId);
        Assert.Equal(testData.ImdbId, result.ImdbId);
        Assert.Equal(MediaType.Movies, result.MediaType);
    }

    public static TheoryData<MovieTestData> MovieTestData =>
    [
        new MovieTestData
        {
            FileName = "The Matrix 1999.mkv",
            Title = "The Matrix",
            TmdbId = 603,
            ImdbId = "tt0133093",
            Year = 1999,
            ReleaseDate = new DateTime(1999, 3, 31, 0, 0, 0, DateTimeKind.Utc)
        },
        new MovieTestData
        {
            FileName = "Inception (2010).mkv",
            Title = "Inception",
            TmdbId = 27205,
            ImdbId = "tt1375666",
            Year = 2010,
            ReleaseDate = new DateTime(2010, 7, 15, 0, 0, 0, DateTimeKind.Utc),
            Popularity = 95.0
        },
        new MovieTestData
        {
            FileName = "Pulp.Fiction.1994.mkv",
            Title = "Pulp Fiction",
            TmdbId = 680,
            ImdbId = "tt0110912",
            Year = 1994,
            ReleaseDate = new DateTime(1994, 10, 14, 0, 0, 0, DateTimeKind.Utc)
        }
    ];

    [Fact]
    public async Task DetectMovieAsyncWithInvalidFileNameReturnsEmptyMediaInfo()
    {
        // Arrange
        const string fileName = "invalid_movie_name.mkv";
        const string filePath = @"D:\Movies\invalid_movie_name.mkv";

        // Act
        var result = await _service.DetectMovieAsync(fileName, filePath);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(MediaType.Movies, result.MediaType);
        Assert.Null(result.Title);
        Assert.Null(result.Year);
    }

    [Fact]
    public async Task DetectMovieAsyncWhenTmdbReturnsNoResultsReturnsEmptyMediaInfo()
    {
        // Arrange
        const string fileName = "The Matrix 1999.mkv";
        const string filePath = @"D:\Movies\The Matrix 1999.mkv";
        var searchContainer = new SearchContainer<SearchMovie>
        {
            Results = new List<SearchMovie>()
        };

        _tmdbClient.SearchMovieAsync("The Matrix").Returns(searchContainer);

        // Act
        var result = await _service.DetectMovieAsync(fileName, filePath);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(MediaType.Movies, result.MediaType);
        Assert.Null(result.Title);
        Assert.Null(result.Year);
    }

    [Fact]
    public async Task DetectMovieByTmdbIdAsyncWithValidIdReturnsMediaInfo()
    {
        // Arrange
        const int tmdbId = 603;
        var movie = new TMDbLib.Objects.Movies.Movie
        {
            Id = tmdbId,
            Title = "The Matrix",
            ReleaseDate = new DateTime(1999, 3, 31, 0, 0, 0, DateTimeKind.Utc)
        };
        var externalIds = new ExternalIdsMovie { ImdbId = "tt0133093" };

        _tmdbClient.GetMovieAsync(tmdbId).Returns(movie);
        _tmdbClient.GetMovieExternalIdsAsync(tmdbId).Returns(externalIds);

        // Act
        var result = await _service.DetectMovieByTmdbIdAsync(tmdbId);

        // Assert
        Assert.NotNull(result);
        Assert.Equal("The Matrix", result.Title);
        Assert.Equal(1999, result.Year);
        Assert.Equal(603, result.TmdbId);
        Assert.Equal("tt0133093", result.ImdbId);
        Assert.Equal(MediaType.Movies, result.MediaType);
    }

    [Fact]
    public async Task DetectMovieByTmdbIdAsyncWithInvalidIdReturnsEmptyMediaInfo()
    {
        // Arrange
        const int tmdbId = -1;
        _tmdbClient.GetMovieAsync(Arg.Any<int>())
            .Returns(Task.FromException<TMDbLib.Objects.Movies.Movie>(new HttpRequestException("Invalid TMDb ID")));

        // Act
        var result = await _service.DetectMovieByTmdbIdAsync(tmdbId);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(MediaType.Movies, result.MediaType);
        Assert.Null(result.Title);
        Assert.Null(result.Year);
    }

    [Fact]
    public async Task DetectMovieAsyncWhenCachedReturnsCachedResult()
    {
        // Arrange
        const string fileName = "The Matrix 1999.mkv";
        const string filePath = @"D:\Movies\The Matrix 1999.mkv";
        var cachedMediaInfo = new MediaInfo
        {
            Title = "The Matrix",
            Year = 1999,
            TmdbId = 603,
            ImdbId = "tt0133093",
            MediaType = MediaType.Movies
        };

        _cache.TryGetValue(Arg.Any<string>(), out _)
            .Returns(callInfo => {
                callInfo[1] = cachedMediaInfo;
                return true;
            });

        // Act
        var result = await _service.DetectMovieAsync(fileName, filePath);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(cachedMediaInfo.Title, result.Title);
        Assert.Equal(cachedMediaInfo.Year, result.Year);
        Assert.Equal(cachedMediaInfo.TmdbId, result.TmdbId);
        Assert.Equal(cachedMediaInfo.ImdbId, result.ImdbId);
        
        // Verify TMDb API was not called
        await _tmdbClient.DidNotReceive().SearchMovieAsync(Arg.Any<string>());
    }
} 
