using Microsoft.AspNetCore.Mvc;
using PlexLocalScan.Shared.Interfaces;

namespace PlexLocalScan.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ScanController : ControllerBase
{
    private readonly IFileTrackingService _fileTrackingService;
    private readonly IMediaDetectionService _mediaDetectionService;
    private readonly ILogger<ScanController> _logger;

    public ScanController(
        IFileTrackingService fileTrackingService,
        IMediaDetectionService mediaDetectionService,
        ILogger<ScanController> logger)
    {
        _fileTrackingService = fileTrackingService;
        _mediaDetectionService = mediaDetectionService;
        _logger = logger;
    }

    [HttpGet("status")]
    public async Task<IActionResult> GetScanStatus()
    {
        //var scannedFiles = await _fileTrackingService.GetRecentScansAsync();
        return Ok();
    }

    [HttpPost("trigger")]
    public async Task<IActionResult> TriggerScan([FromBody] string path)
    {
        try
        {
            //await _mediaDetectionService.ProcessFileAsync(path);
            return Ok(new { message = "Scan triggered successfully" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error triggering scan for path: {Path}", path);
            return StatusCode(500, new { error = "Failed to trigger scan" });
        }
    }
} 