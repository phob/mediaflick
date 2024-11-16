using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using PlexLocalScan.Data.Models;
using PlexLocalScan.Shared.Services;
using TMDbLib.Objects.Search;
using TMDbLib.Objects.TvShows;
using TMDbLib.Objects.General;
using MediaType = PlexLocalScan.Data.Models.MediaType;

namespace PlexLocalScan.Tests.Services;

public class MediaDetectionServiceTests
{
    private readonly Mock<ILogger<MediaDetectionService>> _logger;
    private readonly Mock<ITMDbClientWrapper> _tmdbClient;
    private readonly Mock<IMemoryCache> _cache;
    private readonly Mock<IFileTrackingService> _fileTracking;
    private readonly Mock<IFileSystemService> _fileSystem;
    private readonly Mock<IDateTimeProvider> _dateTimeProvider;
    private readonly MediaDetectionOptions _options;
    private readonly MediaDetectionService _service;

    public MediaDetectionServiceTests()
    {
        _logger = new Mock<ILogger<MediaDetectionService>>();
        _tmdbClient = new Mock<ITMDbClientWrapper>();
        _cache = new Mock<IMemoryCache>();
        _fileTracking = new Mock<IFileTrackingService>();
        _fileSystem = new Mock<IFileSystemService>();
        _dateTimeProvider = new Mock<IDateTimeProvider>();
        
        _options = new MediaDetectionOptions
        {
            MoviePattern = @"^(?<title>.+?)[\. \[]?(?<year>\d{4}).*\.(mkv|mp4|avi)$",
            TvShowPattern = @"^(?<title>.+?)[\. \[]?[Ss](?<season>\d{1,2})[\. \[]?[eE](?<episode>\d{1,2})?[-]?(?:[-eE](?<episode2>\d{1,2}))?.*\.(mkv|mp4|avi)$",
            TitleCleanupPattern = @"^(?<title>.+?)(?:\s\(?(?<year>\d{4})\)?)?\s?[-\s]*$",
            CacheDuration = TimeSpan.FromHours(24)
        };

        _service = new MediaDetectionService(
            _logger.Object,
            _tmdbClient.Object,
            _cache.Object,
            _fileTracking.Object,
            Options.Create(_options),
            _fileSystem.Object,
            _dateTimeProvider.Object
        );

        SetupCache();
    }

    private void SetupCache()
    {
        var cacheEntry = new Mock<ICacheEntry>();
        _cache.Setup(x => x.CreateEntry(It.IsAny<object>()))
            .Returns(cacheEntry.Object);
    }

    [Theory]
    [InlineData("The.Matrix.1999.mkv", "The Matrix", 1999)]
    [InlineData("Inception.2010.mp4", "Inception", 2010)]
    [InlineData("The.Shawshank.Redemption.1994.avi", "The Shawshank Redemption", 1994)]
    public async Task DetectMediaAsync_WithValidMovieFile_ReturnsCorrectMediaInfo(
        string fileName, string expectedTitle, int expectedYear)
    {
        // Arrange
        var searchResults = new SearchContainer<SearchMovie>
        {
            Results = new List<SearchMovie>
            {
                new()
                {
                    Id = 1,
                    Title = expectedTitle,
                    ReleaseDate = new DateTime(expectedYear, 1, 1),
                    Popularity = 10.0
                }
            }
        };

        _tmdbClient.Setup(x => x.SearchMovieAsync(It.IsAny<string>()))
            .ReturnsAsync(searchResults);

        // Act
        var result = await _service.DetectMediaAsync(fileName, MediaType.Movies);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(expectedTitle, result.Title);
        Assert.Equal(expectedYear, result.Year);
        Assert.Equal(MediaType.Movies, result.MediaType);
    }

    [Theory]
    [InlineData("Breaking.Bad.S01E01.mkv", "Breaking Bad", 1, 1)]
    [InlineData("The.Office.S03E05.mp4", "The Office", 3, 5)]
    public async Task DetectMediaAsync_WithValidTvShowFile_ReturnsCorrectMediaInfo(
        string fileName, string expectedTitle, int expectedSeason, int expectedEpisode)
    {
        // Arrange
        var searchResults = new SearchContainer<SearchTv>
        {
            Results = new List<SearchTv>
            {
                new()
                {
                    Id = 1,
                    Name = expectedTitle,
                    FirstAirDate = new DateTime(2000, 1, 1),
                    Popularity = 10.0
                }
            }
        };

        var episodeInfo = new TvEpisode
        {
            Id = 1,
            Name = "Test Episode",
            SeasonNumber = expectedSeason,
            EpisodeNumber = expectedEpisode
        };

        _tmdbClient.Setup(x => x.SearchTvShowAsync(It.IsAny<string>()))
            .ReturnsAsync(searchResults);

        _tmdbClient.Setup(x => x.GetTvEpisodeAsync(
                It.IsAny<int>(), 
                It.IsAny<int>(), 
                It.IsAny<int>()))
            .ReturnsAsync(episodeInfo);

        // Act
        var result = await _service.DetectMediaAsync(fileName, MediaType.TvShows);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(expectedTitle, result.Title);
        Assert.Equal(expectedSeason, result.SeasonNumber);
        Assert.Equal(expectedEpisode, result.EpisodeNumber);
        Assert.Equal(MediaType.TvShows, result.MediaType);
    }

    [Theory]
    [InlineData("invalid_filename.mkv")]
    [InlineData("movie_without_year.mkv")]
    public async Task DetectMediaAsync_WithInvalidMovieFile_ReturnsNull(string fileName)
    {
        // Act
        var result = await _service.DetectMediaAsync(fileName, MediaType.Movies);

        // Assert
        Assert.Null(result);
        _fileTracking.Verify(x => x.UpdateStatusAsync(
            It.IsAny<string>(),
            null,
            MediaType.Movies,
            null,
            FileStatus.Failed
        ), Times.Once);
    }

    [Fact]
    public async Task DetectMediaAsync_WhenTMDbReturnsNoResults_ReturnsNull()
    {
        // Arrange
        var searchResults = new SearchContainer<SearchMovie>
        {
            Results = new List<SearchMovie>()
        };

        _tmdbClient.Setup(x => x.SearchMovieAsync(It.IsAny<string>()))
            .ReturnsAsync(searchResults);

        // Act
        var result = await _service.DetectMediaAsync("The.Matrix.1999.mkv", MediaType.Movies);

        // Assert
        Assert.Null(result);
        _fileTracking.Verify(x => x.UpdateStatusAsync(
            It.IsAny<string>(),
            null,
            MediaType.Movies,
            null,
            FileStatus.Failed
        ), Times.Once);
    }

    [Fact]
    public async Task DetectMediaAsync_WhenTMDbThrowsException_HandlesError()
    {
        // Arrange
        _tmdbClient.Setup(x => x.SearchMovieAsync(It.IsAny<string>()))
            .ThrowsAsync(new HttpRequestException("API Error"));

        // Act & Assert
        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
            await _service.DetectMediaAsync("The.Matrix.1999.mkv", MediaType.Movies));

        _logger.Verify(x => x.Log(
            LogLevel.Error,
            It.IsAny<EventId>(),
            It.Is<It.IsAnyType>((v, t) => true),
            It.IsAny<Exception>(),
            It.Is<Func<It.IsAnyType, Exception?, string>>((v, t) => true)),
            Times.AtLeastOnce);
    }
} 