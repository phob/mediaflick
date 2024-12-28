using Microsoft.AspNetCore.Mvc;
using PlexLocalScan.Shared.Interfaces;
using PlexLocalScan.Shared.Services;
using System.ComponentModel;
using PlexLocalScan.Core.Media;
using PlexLocalScan.Core.Series;

namespace PlexLocalScan.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
[ApiExplorerSettings(GroupName = "v1")]
[Description("Provides media lookup functionality using TMDb")]
public class MediaLookupController(
    IMediaLookupService mediaLookupService,
    ILogger<MediaLookupController> logger) : ControllerBase
{
    /// <summary>
    /// Searches for movies by title
    /// </summary>
    /// <param name="title">The movie title to search for</param>
    /// <response code="200">Returns a list of matching movies</response>
    /// <response code="400">If the title is null or empty</response>
    [HttpGet("movies/search")]
    [ProducesResponseType(typeof(List<MediaSearchResult>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<List<MediaSearchResult>>> SearchMovies([FromQuery] string title)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            return BadRequest("Title is required");
        }

        logger.LogInformation("Searching for movies with title: {Title}", title);
        var results = await mediaLookupService.SearchMovieTmdbIdsAsync(title);
        return Ok(results);
    }

    /// <summary>
    /// Searches for TV shows by title
    /// </summary>
    /// <param name="title">The TV show title to search for</param>
    /// <response code="200">Returns a list of matching TV shows</response>
    /// <response code="400">If the title is null or empty</response>
    [HttpGet("tvshows/search")]
    [ProducesResponseType(typeof(List<MediaSearchResult>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<List<MediaSearchResult>>> SearchTvShows([FromQuery] string title)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            return BadRequest("Title is required");
        }

        logger.LogInformation("Searching for TV shows with title: {Title}", title);
        var results = await mediaLookupService.SearchTvShowTmdbIdsAsync(title);
        return Ok(results);
    }

    /// <summary>
    /// Gets detailed information about a movie by TMDb ID
    /// </summary>
    /// <param name="tmdbId">The TMDb ID of the movie</param>
    /// <response code="200">Returns the movie information</response>
    /// <response code="404">If the movie is not found</response>
    [HttpGet("movies/{tmdbId}")]
    [ProducesResponseType(typeof(MediaInfo), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<MediaInfo>> GetMovieInfo(int tmdbId)
    {
        logger.LogInformation("Getting movie info for TMDb ID: {TmdbId}", tmdbId);
        var movieInfo = await mediaLookupService.GetMovieMediaInfoAsync(tmdbId);
        
        if (movieInfo == null)
        {
            return NotFound();
        }

        return Ok(movieInfo);
    }

    /// <summary>
    /// Gets detailed information about a TV show by TMDb ID
    /// </summary>
    /// <param name="tmdbId">The TMDb ID of the TV show</param>
    /// <response code="200">Returns the TV show information</response>
    /// <response code="404">If the TV show is not found</response>
    [HttpGet("tvshows/{tmdbId}")]
    [ProducesResponseType(typeof(MediaInfo), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<MediaInfo>> GetTvShowInfo(int tmdbId)
    {
        logger.LogInformation("Getting TV show info for TMDb ID: {TmdbId}", tmdbId);
        var tvShowInfo = await mediaLookupService.GetTvShowMediaInfoAsync(tmdbId);
        
        if (tvShowInfo == null)
        {
            return NotFound();
        }

        return Ok(tvShowInfo);
    }

    /// <summary>
    /// Gets detailed information about a TV season by TMDb ID
    /// </summary>
    /// <param name="tmdbId">The TMDb ID of the TV show</param>
    /// <param name="seasonNumber">The season number of the TV show</param>
    /// <response code="200">Returns the TV season information</response>
    /// <response code="404">If the TV season is not found</response>
    [HttpGet("tvshows/{tmdbId}/seasons/{seasonNumber}")]
    [ProducesResponseType(typeof(MediaInfo), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<MediaInfo>> GetTvSeasonInfo(int tmdbId, int seasonNumber)
    {
        logger.LogInformation("Getting TV season info for TMDb ID: {TmdbId}, Season Number: {SeasonNumber}", tmdbId, seasonNumber);
        var tvSeasonInfo = await mediaLookupService.GetTvShowSeasonMediaInfoAsync(tmdbId, seasonNumber);

        if (tvSeasonInfo == null)
        {
            return NotFound();
        }
        return Ok(tvSeasonInfo);
    }

    /// <summary>
    /// Gets detailed information about a TV episode by TMDb ID
    /// </summary>
    /// <param name="tmdbId">The TMDb ID of the TV show</param>
    /// <param name="seasonNumber">The season number of the TV show</param>
    /// <param name="episodeNumber">The episode number of the TV show</param>
    /// <response code="200">Returns the TV episode information</response>
    /// <response code="404">If the TV episode is not found</response>
    [HttpGet("tvshows/{tmdbId}/seasons/{seasonNumber}/episodes/{episodeNumber}")]
    [ProducesResponseType(typeof(EpisodeInfo), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<EpisodeInfo>> GetTvEpisodeInfo(int tmdbId, int seasonNumber, int episodeNumber)
    {
        logger.LogInformation("Getting TV episode info for TMDb ID: {TmdbId}, Season Number: {SeasonNumber}, Episode Number: {EpisodeNumber}", tmdbId, seasonNumber, episodeNumber);
        var tvEpisodeInfo = await mediaLookupService.GetTvShowEpisodeMediaInfoAsync(tmdbId, seasonNumber, episodeNumber);

        if (tvEpisodeInfo == null)
        {
            return NotFound();
        }

        return Ok(tvEpisodeInfo);
    }

    /// <summary>
    /// Gets the URL for an image by TMDb path and size
    /// </summary>
    /// <param name="path">The TMDb path of the image</param>
    /// <param name="size">The size of the image</param>
    /// <response code="200">Returns the image URL</response>
    /// <response code="400">If the path or size is null or empty</response>
    [HttpGet("images/{*path}")]
    [ProducesResponseType(typeof(string), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetImageUrl([FromRoute] string path, [FromQuery] string size = "w500")
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            return BadRequest("Path is required");
        }

        var imageUrl = await mediaLookupService.GetImageUrlAsync(path, size);
        if (imageUrl == null)
        {
            return NotFound();
        }

        // Redirect to the actual TMDb image URL
        return RedirectPermanent(imageUrl);
    }
} 