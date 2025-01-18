using PlexLocalScan.Shared.Services;
using PlexLocalScan.Shared.TmDbMediaSearch.Services;

namespace PlexLocalScan.Test.Integration;

public sealed class TmDbClientWrapperIntegrationTests : IDisposable
{
    private readonly TmDbClientWrapper _client;

    public TmDbClientWrapperIntegrationTests()
    {
        const string apiKey = "fc03d062b72e55cdc9ce9e7c0960544f"; // Replace with a valid TMDb API key
        _client = new TmDbClientWrapper(apiKey);
    }

    public void Dispose() => Dispose(true);

    private void Dispose(bool disposing)
    {
        if (disposing)
        {
            _client.Dispose();
        }
    }

    [Fact]
    public async Task SearchTvShowAsync_ReturnsExpectedResults()
    {
        // Arrange
        const string query = "The Last of Us";

        // Act
        var result = await _client.SearchTvShowAsync(query);

        // Assert
        Assert.NotNull(result);
        Assert.NotEmpty(result.Results);
        Assert.Contains(result.Results, tv => tv.Name == query);
    }

    [Fact]
    public async Task GetTvShowAsync_ReturnsTvShowDetails()
    {
        // Arrange
        var tmdbId = 100088; // ID for "The Last of Us"

        // Act
        var tvShow = await _client.GetTvShowAsync(tmdbId);

        // Assert
        Assert.NotNull(tvShow);
        Assert.Equal(tmdbId, tvShow.Id);
        Assert.Equal("The Last of Us", tvShow.Name);
    }
}
