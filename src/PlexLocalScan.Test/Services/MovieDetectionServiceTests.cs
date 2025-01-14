using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Caching.Memory;
using Moq;
using PlexLocalScan.Core.Media;
using PlexLocalScan.Core.Tables;
using PlexLocalScan.FileTracking.Services;
using PlexLocalScan.Shared.Interfaces;
using PlexLocalScan.Shared.Options;
using PlexLocalScan.Shared.Services;
using TMDbLib.Objects.General;
using TMDbLib.Objects.Search;
using MediaType = PlexLocalScan.Core.Tables.MediaType;

namespace PlexLocalScan.Test.Services;

public class MovieDetectionServiceTests
{
    private readonly Mock<ILogger<MovieDetectionService>> _loggerMock;
    private readonly Mock<ITmDbClientWrapper> _tmdbClientMock;
    private readonly Mock<IMemoryCache> _cacheMock;
    private readonly Mock<IContextService> _fileTrackingServiceMock;
    private readonly IOptions<MediaDetectionOptions> _options;
    private readonly MovieDetectionService _service;

    public MovieDetectionServiceTests()
    {
        _loggerMock = new Mock<ILogger<MovieDetectionService>>();
        _tmdbClientMock = new Mock<ITmDbClientWrapper>();
        _cacheMock = new Mock<IMemoryCache>();
        _fileTrackingServiceMock = new Mock<IContextService>();
        _options = Options.Create(new MediaDetectionOptions { CacheDuration = TimeSpan.FromMinutes(30) });

        // Setup cache mock to accept any Set operations
        _cacheMock.Setup(x => x.CreateEntry(It.IsAny<object>()))
            .Returns(Mock.Of<ICacheEntry>());

        _service = new MovieDetectionService(
            _loggerMock.Object,
            _tmdbClientMock.Object,
            _cacheMock.Object,
            _fileTrackingServiceMock.Object,
            _options
        );
    }

    [Fact]
    public async Task DetectMovieAsyncWithValidFileNameReturnsMediaInfo()
    {
        // Arrange
        const string fileName = "The Matrix 1999.mkv";
        const string filePath = @"D:\Movies\The Matrix 1999.mkv";
        var searchContainer = new SearchContainer<SearchMovie>
        {
            Results = new List<SearchMovie>
            {
                new()
                {
                    Id = 603,
                    Title = "The Matrix",
                    ReleaseDate = new DateTime(1999, 3, 31, 0, 0, 0, DateTimeKind.Utc),
                    Popularity = 100.0
                }
            }
        };

        var externalIds = new ExternalIdsMovie { ImdbId = "tt0133093" };

        _tmdbClientMock.Setup(x => x.SearchMovieAsync("The Matrix"))
            .ReturnsAsync(searchContainer);
        _tmdbClientMock.Setup(x => x.GetMovieExternalIdsAsync(603))
            .ReturnsAsync(externalIds);

        // Act
        MediaInfo? result = await _service.DetectMovieAsync(fileName, filePath);

        // Assert
        Assert.NotNull(result);
        if (result != null)
        {
            Assert.Equal("The Matrix", result.Title);
            Assert.Equal(1999, result.Year);
            Assert.Equal(603, result.TmdbId);
            Assert.Equal("tt0133093", result.ImdbId);
            Assert.Equal(MediaType.Movies, result.MediaType);
        }
    }

    [Fact]
    public async Task DetectMovieAsyncWithInvalidFileNameReturnsEmptyMediaInfo()
    {
        // Arrange
        const string fileName = "invalid_movie_name.mkv";
        const string filePath = @"D:\Movies\invalid_movie_name.mkv";

        // Act
        MediaInfo result = await _service.DetectMovieAsync(fileName, filePath);

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

        _tmdbClientMock.Setup(x => x.SearchMovieAsync("The Matrix"))
            .ReturnsAsync(searchContainer);

        // Act
        MediaInfo? result = await _service.DetectMovieAsync(fileName, filePath);

        // Assert
        Assert.NotNull(result);
        if (result != null)
        {
            Assert.Equal(MediaType.Movies, result.MediaType);
            Assert.Null(result.Title);
            Assert.Null(result.Year);
        }
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

        _tmdbClientMock.Setup(x => x.GetMovieAsync(tmdbId))
            .ReturnsAsync(movie);
        _tmdbClientMock.Setup(x => x.GetMovieExternalIdsAsync(tmdbId))
            .ReturnsAsync(externalIds);

        // Act
        MediaInfo? result = await _service.DetectMovieByTmdbIdAsync(tmdbId);

        // Assert
        Assert.NotNull(result);
        if (result != null)
        {
            Assert.Equal("The Matrix", result.Title);
            Assert.Equal(1999, result.Year);
            Assert.Equal(603, result.TmdbId);
            Assert.Equal("tt0133093", result.ImdbId);
            Assert.Equal(MediaType.Movies, result.MediaType);
        }
    }

    [Fact]
    public async Task DetectMovieByTmdbIdAsyncWithInvalidIdReturnsEmptyMediaInfo()
    {
        // Arrange
        const int tmdbId = -1;
        _tmdbClientMock.Setup(x => x.GetMovieAsync(It.IsAny<int>()))
            .ThrowsAsync(new HttpRequestException("Invalid TMDb ID"));

        // Act
        MediaInfo result = await _service.DetectMovieByTmdbIdAsync(tmdbId);

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

        object? cached = cachedMediaInfo;
        _cacheMock.Setup(x => x.TryGetValue(It.IsAny<string>(), out cached))
            .Returns(true);

        // Act
        MediaInfo? result = await _service.DetectMovieAsync(fileName, filePath);

        // Assert
        Assert.NotNull(result);
        if (result != null)
        {
            Assert.Equal(cachedMediaInfo.Title, result.Title);
            Assert.Equal(cachedMediaInfo.Year, result.Year);
            Assert.Equal(cachedMediaInfo.TmdbId, result.TmdbId);
            Assert.Equal(cachedMediaInfo.ImdbId, result.ImdbId);
        }
        
        // Verify TMDb API was not called
        _tmdbClientMock.Verify(x => x.SearchMovieAsync(It.IsAny<string>()), Times.Never);
    }
} 