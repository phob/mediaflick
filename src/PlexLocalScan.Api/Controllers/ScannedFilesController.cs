using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PlexLocalScan.Data.Data;
using PlexLocalScan.Data.Models;
using PlexLocalScan.Api.Models;
using PlexLocalScan.Shared.Interfaces;
using System.ComponentModel;

namespace PlexLocalScan.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
[ApiExplorerSettings(GroupName = "v1")]
[Description("Manages scanned media files and their processing status")]
public class ScannedFilesController(
    PlexScanContext context,
    ISymlinkRecreationService symlinkRecreationService) : ControllerBase
{
    /// <summary>
    /// Retrieves a paged list of scanned files with optional filtering and sorting
    /// </summary>
    /// <param name="filter">Filter criteria for the search</param>
    /// <param name="page">Page number (1-based)</param>
    /// <param name="pageSize">Number of items per page</param>
    /// <response code="200">Returns the paged list of scanned files</response>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<ScannedFile>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<ScannedFile>>> GetScannedFiles(
        [FromQuery] ScannedFileFilter filter,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 10)
    {
        var query = context.ScannedFiles.AsQueryable();

        // Apply filters
        if (filter.Status.HasValue)
        {
            query = query.Where(f => f.Status == filter.Status.Value);
        }

        if (filter.MediaType.HasValue)
        {
            query = query.Where(f => f.MediaType == filter.MediaType.Value);
        }

        if (!string.IsNullOrEmpty(filter.SearchTerm))
        {
            query = query.Where(f => 
                f.SourceFile.Contains(filter.SearchTerm) || 
                (f.DestFile != null && f.DestFile.Contains(filter.SearchTerm)));
        }

        // Apply sorting
        query = filter.SortBy?.ToLower() switch
        {
            "createdat" => filter.SortOrder?.ToLower() == "desc" 
                ? query.OrderByDescending(f => f.CreatedAt)
                : query.OrderBy(f => f.CreatedAt),
            "updatedat" => filter.SortOrder?.ToLower() == "desc"
                ? query.OrderByDescending(f => f.UpdatedAt)
                : query.OrderBy(f => f.UpdatedAt),
            _ => query.OrderByDescending(f => f.CreatedAt) // Default sorting
        };

        var totalItems = await query.CountAsync();
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return Ok(new PagedResult<ScannedFile>
        {
            Items = items,
            TotalItems = totalItems,
            Page = page,
            PageSize = pageSize,
            TotalPages = (int)Math.Ceiling(totalItems / (double)pageSize)
        });
    }

    /// <summary>
    /// Retrieves a specific scanned file by its ID
    /// </summary>
    /// <param name="id">The ID of the scanned file</param>
    /// <response code="200">Returns the requested scanned file</response>
    /// <response code="404">If the scanned file is not found</response>
    [HttpGet("{id}")]
    [ProducesResponseType(typeof(ScannedFile), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ScannedFile>> GetScannedFile(int id)
    {
        var scannedFile = await context.ScannedFiles.FindAsync(id);
        
        if (scannedFile == null)
        {
            return NotFound();
        }

        return Ok(scannedFile);
    }

    /// <summary>
    /// Retrieves statistics about scanned files, including counts by status and media type
    /// </summary>
    /// <response code="200">Returns the statistics for scanned files</response>
    [HttpGet("stats")]
    [ProducesResponseType(typeof(ScannedFileStats), StatusCodes.Status200OK)]
    public async Task<ActionResult<ScannedFileStats>> GetStats()
    {
        var stats = new ScannedFileStats
        {
            TotalFiles = await context.ScannedFiles.CountAsync(),
            ByStatus = await context.ScannedFiles
                .GroupBy(f => f.Status)
                .Select(g => new StatusCount { Status = g.Key, Count = g.Count() })
                .ToListAsync(),
            ByMediaType = await context.ScannedFiles
                .Where(f => f.MediaType.HasValue)
                .GroupBy(f => f.MediaType!.Value)
                .Select(g => new MediaTypeCount { MediaType = g.Key, Count = g.Count() })
                .ToListAsync()
        };

        return Ok(stats);
    }

    /// <summary>
    /// Updates the TMDb ID, season number, and episode number for a scanned file
    /// </summary>
    /// <param name="id">The ID of the scanned file to update</param>
    /// <param name="request">The update request containing the new values</param>
    /// <response code="200">Returns the updated scanned file</response>
    /// <response code="404">If the scanned file is not found</response>
    /// <response code="400">If the update request is invalid</response>
    [HttpPatch("{id}")]
    [ProducesResponseType(typeof(ScannedFile), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ScannedFile>> UpdateScannedFile(int id, [FromBody] UpdateScannedFileRequest request)
    {
        var scannedFile = await context.ScannedFiles.FindAsync(id);
        
        if (scannedFile == null)
        {
            return NotFound();
        }

        // Update only the provided values
        if (request.TmdbId.HasValue)
            scannedFile.TmdbId = request.TmdbId.Value;
        
        if (request.SeasonNumber.HasValue)
            scannedFile.SeasonNumber = request.SeasonNumber.Value;
        
        if (request.EpisodeNumber.HasValue)
            scannedFile.EpisodeNumber = request.EpisodeNumber.Value;

        scannedFile.UpdatedAt = DateTime.UtcNow;
        scannedFile.UpdateToVersion++;

        try
        {
            await context.SaveChangesAsync();

            // Attempt to recreate the symlink with the new information
            var success = await symlinkRecreationService.RecreateSymlinkIfNeededAsync(scannedFile);
            if (!success)
            {
                return BadRequest(new { error = "Failed to recreate symlink" });
            }

            // Refresh the entity from the database to get the latest version
            await context.Entry(scannedFile).ReloadAsync();
            return Ok(scannedFile);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = "Failed to update the scanned file", details = ex.Message });
        }
    }
} 