using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

using PlexLocalScan.Shared.Configuration.Options;
using PlexLocalScan.Shared.Plex.Interfaces;

namespace PlexLocalScan.Shared.Plex.Services;

public class PlexHandler(
    ILogger<PlexHandler> logger,
    IOptionsSnapshot<PlexOptions> options,
    HttpClient httpClient
) : IPlexHandler
{
    private readonly PlexOptions _options = options.Value;

    private async Task<string> GetSectionIdForPathAsync(string folderPath)
    {
        try
        {
            var url = $"{_options.ApiEndpoint}/library/sections?X-Plex-Token={_options.PlexToken}";
            var response = await httpClient.GetStringAsync(new Uri(url));

            var doc = new System.Xml.XmlDocument();
            doc.LoadXml(response);

            var directories = doc.SelectNodes("//Directory");
            if (directories == null)
            {
                return "all";
            }

            foreach (System.Xml.XmlNode dir in directories)
            {
                var locations = dir.SelectNodes("Location");
                if (locations == null)
                {
                    continue;
                }

                foreach (System.Xml.XmlNode loc in locations)
                {
                    var pathAttr = loc.Attributes?["path"];
                    if (
                        pathAttr?.Value != null
                        && folderPath.StartsWith(pathAttr.Value, StringComparison.OrdinalIgnoreCase)
                    )
                    {
                        var keyAttr = dir.Attributes?["key"];
                        return keyAttr?.Value ?? "all";
                    }
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(
                ex,
                "Failed to get section ID from Plex, using 'all' as fallback: {Message}",
                ex.Message
            );
        }

        return "all";
    }

    private string FindBasePath(string folderPath)
    {
        return _options
                .FolderMappings.FirstOrDefault(m =>
                    folderPath.StartsWith(m.DestinationFolder, StringComparison.OrdinalIgnoreCase)
                )
                ?.DestinationFolder ?? folderPath;
    }

    public async Task UpdateFolderForScanningAsync(
        string folderPath,
        FolderAction action = FolderAction.Refresh
    )
    {
        try
        {
            if (string.IsNullOrEmpty(_options.PlexToken))
            {
                logger.LogWarning(
                    "Plex token is not set, skipping folder for scanning: {FolderPath}",
                    folderPath
                );
                return;
            }

            logger.LogInformation("{Action} folder in Plex: {FolderPath}", action, folderPath);

            var basePath = FindBasePath(folderPath);
            var sectionId = await GetSectionIdForPathAsync(basePath);
            logger.LogDebug(
                "Found section ID: {SectionId} for base folder: {BaseFolder}",
                sectionId,
                basePath
            );

            var encodedPath = Uri.EscapeDataString(folderPath);
            var url =
                $"{_options.ApiEndpoint}/library/sections/{sectionId}/refresh"
                + $"?path={encodedPath}"
                + $"&async=1"
                + $"&X-Plex-Token={_options.PlexToken}";

            logger.LogDebug(
                "Request URL: {Url}",
                url.Replace(_options.PlexToken, "REDACTED", StringComparison.OrdinalIgnoreCase)
            );

            var response = await httpClient.GetAsync(url);

            if (response.IsSuccessStatusCode)
            {
                logger.LogInformation(
                    "Successfully initiated {Action} for folder: {FolderPath}",
                    action,
                    folderPath
                );
            }
            else
            {
                logger.LogWarning(
                    "Failed to initiate Plex {Action} for folder: {FolderPath}. Status code: {StatusCode}",
                    action,
                    folderPath,
                    response.StatusCode
                );
            }

            // Only execute empty trash for Delete action
            if (action == FolderAction.Delete)
            {
                var urlTrash =
                    $"{_options.ApiEndpoint}/library/sections/{sectionId}/emptyTrash"
                    + $"?X-Plex-Token={_options.PlexToken}";

                logger.LogDebug(
                    "Request URL: {Url}",
                    urlTrash.Replace(
                        _options.PlexToken,
                        "REDACTED",
                        StringComparison.OrdinalIgnoreCase
                    )
                );

                var responseTrash = await httpClient.PutAsync(urlTrash, null);
                if (responseTrash.IsSuccessStatusCode)
                {
                    logger.LogInformation("Successfully emptied trash");
                }
                else
                {
                    logger.LogWarning(
                        "Failed to empty trash: {StatusCode}",
                        responseTrash.StatusCode
                    );
                }
            }
        }
        catch (HttpRequestException ex)
        {
            logger.LogWarning(ex, "Could not connect to Plex server: {Message}", ex.Message);
        }
        catch (Exception ex)
        {
            logger.LogWarning(
                ex,
                "Failed to process {Action} for folder: {FolderPath}. Error: {Message}",
                action,
                folderPath,
                ex.Message
            );
        }
    }
}
