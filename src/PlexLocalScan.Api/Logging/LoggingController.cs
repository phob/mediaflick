using System.Text.Json.Nodes;
using Serilog.Events;

namespace PlexLocalScan.Api.Logging;

public class LoggingController
{
    private readonly ILogger<LoggingController> _logger;

    public LoggingController(ILogger<LoggingController> logger)
    {
        _logger = logger;
    }

    public async Task<IResult> GetLogs(
        LogEventLevel? minLevel,
        string? searchTerm,
        DateTime? from,
        DateTime? to,
        int limit = 100
    )
    {
        try
        {
            var logsPath = Path.Combine(AppContext.BaseDirectory, "logs");
            var logFiles = Directory.GetFiles(logsPath, "log*.json").OrderByDescending(f => f); // Latest files first

            var logs = new List<JsonObject>();
            foreach (var file in logFiles)
            {
                if (logs.Count >= limit)
                    break;

                var fileContent = await File.ReadAllLinesAsync(file);
                foreach (var line in fileContent.Reverse()) // Latest entries first
                {
                    if (logs.Count >= limit)
                        break;

                    if (string.IsNullOrWhiteSpace(line))
                        continue;

                    var logEntry = JsonNode.Parse(line)?.AsObject();
                    if (logEntry == null)
                        continue;

                    // Apply filters
                    if (minLevel != null)
                    {
                        var level = Enum.Parse<LogEventLevel>(
                            logEntry["Level"]?.GetValue<string>() ?? "Information"
                        );
                        if (level < minLevel)
                            continue;
                    }

                    if (searchTerm != null)
                    {
                        var message = logEntry["RenderedMessage"]?.GetValue<string>() ?? "";
                        if (!message.Contains(searchTerm, StringComparison.OrdinalIgnoreCase))
                            continue;
                    }

                    if (from != null || to != null)
                    {
                        if (
                            !DateTime.TryParse(
                                logEntry["Timestamp"]?.GetValue<string>(),
                                out var timestamp
                            )
                        )
                            continue;

                        if (timestamp < from)
                            continue;
                        if (timestamp > to)
                            continue;
                    }

                    logs.Add(logEntry);
                }
            }

            return Results.Ok(new { logs });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving logs");
            return Results.Problem(
                detail: "An error occurred while retrieving logs",
                statusCode: StatusCodes.Status500InternalServerError
            );
        }
    }
}
