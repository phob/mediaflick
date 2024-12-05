using System.ComponentModel;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using PlexLocalScan.Data.Data;
using PlexLocalScan.Data.Models;
using PlexLocalScan.Api.Models;
using PlexLocalScan.Shared.Interfaces;
using PlexLocalScan.Shared.Options;

namespace PlexLocalScan.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Produces("application/json")]
[ApiExplorerSettings(GroupName = "v1")]
[Description("Manages scanned media files and their processing status")]
public class ScannedFilesController(
    PlexScanContext context,
    ISymlinkRecreationService symlinkRecreationService,
    IOptions<PlexOptions> plexOptions,
    ICleanupHandler cleanupHandler,
    ILogger<ScannedFilesController> logger) : ControllerBase
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
        logger.LogInformation(
            "Getting scanned files. Page: {Page}, PageSize: {PageSize}, Status: {Status}, MediaType: {MediaType}, SearchTerm: {SearchTerm}, SortBy: {SortBy}, SortOrder: {SortOrder}",
            page, pageSize, filter.Status, filter.MediaType, filter.SearchTerm, filter.SortBy, filter.SortOrder);

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
            var searchTerm = filter.SearchTerm.ToLower();
            query = query.Where(f =>
                EF.Functions.Like(f.SourceFile.ToLower(), $"%{searchTerm}%") ||
                (f.DestFile != null && EF.Functions.Like(f.DestFile.ToLower(), $"%{searchTerm}%")));
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
            "sourcefile" => filter.SortOrder?.ToLower() == "desc"
                ? query.OrderByDescending(f => f.SourceFile)
                : query.OrderBy(f => f.SourceFile),
            "destfile" => filter.SortOrder?.ToLower() == "desc"
                ? query.OrderByDescending(f => f.DestFile)
                : query.OrderBy(f => f.DestFile),
            "status" => filter.SortOrder?.ToLower() == "desc"
                ? query.OrderByDescending(f => f.Status)
                : query.OrderBy(f => f.Status),
            "mediatype" => filter.SortOrder?.ToLower() == "desc"
                ? query.OrderByDescending(f => f.MediaType)
                : query.OrderBy(f => f.MediaType),
            "seasonnumber" => filter.SortOrder?.ToLower() == "desc"
                ? query.OrderByDescending(f => f.SeasonNumber)
                : query.OrderBy(f => f.SeasonNumber),
            "episodenumber" => filter.SortOrder?.ToLower() == "desc"
                ? query.OrderByDescending(f => f.EpisodeNumber)
                : query.OrderBy(f => f.EpisodeNumber),
            _ => query.OrderByDescending(f => f.CreatedAt) // Default sorting
        };

        var totalItems = await query.CountAsync();
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        logger.LogInformation(
            "Retrieved {Count} scanned files. Total items: {TotalItems}, Total pages: {TotalPages}",
            items.Count, totalItems, (int)Math.Ceiling(totalItems / (double)pageSize));

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
        logger.LogInformation("Getting scanned file with ID: {Id}", id);
        var scannedFile = await context.ScannedFiles.FindAsync(id);

        if (scannedFile == null)
        {
            logger.LogWarning("Scanned file with ID {Id} not found", id);
            return NotFound();
        }

        logger.LogInformation("Retrieved scanned file: {@ScannedFile}", scannedFile);
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
        logger.LogInformation("Getting scanned files statistics");

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

        logger.LogInformation("Retrieved statistics: {@Stats}", stats);
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
        try
        {
            logger.LogInformation("Updating scanned file {Id} with request: {@Request}", id, request);

            var scannedFile = await context.ScannedFiles.FindAsync(id);

            if (scannedFile == null)
            {
                logger.LogWarning("Scanned file with ID {Id} not found", id);
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

            await context.SaveChangesAsync();
            
            return Ok(scannedFile);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to update scanned file {Id}", id);
            return BadRequest(new { error = "Failed to update the scanned file", details = ex.Message });
        }
    }

    /// <summary>
    /// Recreates the symlink for a scanned file
    /// </summary>
    /// <param name="id">The ID of the scanned file to recreate the symlink for</param>
    /// <response code="200">Returns the updated scanned file</response>
    /// <response code="404">If the scanned file is not found</response>
    /// <response code="400">If the symlink creation fails</response>
    [HttpPatch("{id}/recreate-symlink")]
    [ProducesResponseType(typeof(ScannedFile), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ScannedFile>> RecreateSymlink(int id)
    {
        try
        {
            var scannedFile = await context.ScannedFiles.FindAsync(id);
            if (scannedFile == null)
            {
                logger.LogWarning("Scanned file with ID {Id} not found", id);
                return NotFound();
            }

            await context.SaveChangesAsync();

            // Attempt to recreate the symlink with the new information
            var success = await symlinkRecreationService.RecreateSymlinkIfNeededAsync(scannedFile);
            if (!success)
            {
                logger.LogError("Failed to recreate symlink for scanned file {Id}", id);
                return BadRequest(new { error = "Failed to recreate symlink" });
            }

            // Refresh the entity from the database to get the latest version
            await context.Entry(scannedFile).ReloadAsync();
            logger.LogInformation("Successfully updated scanned file {Id}: {@ScannedFile}", id, scannedFile);
            return Ok(scannedFile);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to update scanned file {Id}", id);
            return BadRequest(new { error = "Failed to update the scanned file", details = ex.Message });
        }
    }

    /// <summary>
    /// Deletes a single scanned file by its ID
    /// </summary>
    /// <param name="id">The ID of the scanned file to delete</param>
    /// <response code="204">If the scanned file was successfully deleted</response>
    /// <response code="404">If the scanned file is not found</response>
    [HttpDelete("{id}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteScannedFile(int id)
    {
        logger.LogInformation("Deleting scanned file with ID: {Id}", id);

        var scannedFile = await context.ScannedFiles.FindAsync(id);
        if (scannedFile == null)
        {
            logger.LogWarning("Scanned file with ID {Id} not found", id);
            return NotFound();
        }
        var folderMapping = plexOptions.Value.FolderMappings
            .FirstOrDefault(fm => fm.MediaType == scannedFile.MediaType);

        if (folderMapping != null)
        {
            if (!string.IsNullOrEmpty(scannedFile.DestFile))
            {
                System.IO.File.Delete(scannedFile.DestFile);
            }
            await cleanupHandler.CleanupDeadSymlinksAsync(folderMapping.DestinationFolder);
        }

        context.ScannedFiles.Remove(scannedFile);
        await context.SaveChangesAsync();

        logger.LogInformation("Successfully deleted scanned file with ID: {Id}", id);
        return NoContent();
    }

    /// <summary>
    /// Deletes multiple scanned files by their IDs
    /// </summary>
    /// <param name="ids">Array of scanned file IDs to delete</param>
    /// <response code="204">If the scanned files were successfully deleted</response>
    /// <response code="400">If the request is invalid</response>
    [HttpDelete("batch")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> DeleteScannedFiles([FromBody] int[] ids)
    {
        if (ids == null || !ids.Any())
        {
            return BadRequest(new { error = "No IDs provided for deletion" });
        }

        logger.LogInformation("Deleting multiple scanned files. IDs: {@Ids}", ids);

        var filesToDelete = await context.ScannedFiles
            .Where(f => ids.Contains(f.Id))
            .ToListAsync();

        if (filesToDelete.Any())
        {
            // Group files by media type for efficient cleanup
            var filesByMediaType = filesToDelete.GroupBy(f => f.MediaType);
            
            foreach (var mediaTypeGroup in filesByMediaType)
            {
                if (!mediaTypeGroup.Key.HasValue) continue;
                
                var folderMapping = plexOptions.Value.FolderMappings
                    .FirstOrDefault(fm => fm.MediaType == mediaTypeGroup.Key);

                if (folderMapping != null)
                {
                    // Delete all destination files for this media type
                    foreach (var file in mediaTypeGroup)
                    {
                        if (!string.IsNullOrEmpty(file.DestFile))
                        {
                            System.IO.File.Delete(file.DestFile);
                        }
                    }
                    
                    // Clean up empty directories once per media type
                    await cleanupHandler.CleanupDeadSymlinksAsync(folderMapping.DestinationFolder);
                }
            }

            context.ScannedFiles.RemoveRange(filesToDelete);
            await context.SaveChangesAsync();
        }

        logger.LogInformation("Successfully deleted {Count} scanned files", filesToDelete.Count);
        return NoContent();
    }

    [HttpPost("recreate-symlinks")]
    public async Task<IActionResult> RecreateSymlinks()
    {
        var successCount = await symlinkRecreationService.RecreateAllSymlinksAsync();
        return Ok(new { SuccessCount = successCount });
    }
}