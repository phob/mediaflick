using Microsoft.AspNetCore.Mvc;
using PlexLocalScan.Shared.Interfaces;
using PlexLocalScan.Shared.Services;
using System.ComponentModel;

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
} 