using Microsoft.Extensions.Options;
using Microsoft.Extensions.Logging;
using PlexLocalScan.Shared.Configuration.Options;
using System.Web;
using PlexLocalScan.Shared.Interfaces;

namespace PlexLocalScan.Shared.Services;

public class PlexHandler(ILogger<PlexHandler> logger, IOptionsSnapshot<PlexOptions> options, HttpClient httpClient)
    : IPlexHandler
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
                    if (pathAttr?.Value != null && folderPath.StartsWith(pathAttr.Value, StringComparison.OrdinalIgnoreCase))
                    {
                        var keyAttr = dir.Attributes?["key"];
                        return keyAttr?.Value ?? "all";
                    }
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to get section ID from Plex, using 'all' as fallback: {Message}", 
                ex.Message);
        }
        
        return "all";
    }

    public async Task AddFolderForScanningAsync(string folderPath, string baseFolder)
    {
        try
        {
            logger.LogInformation("Adding folder for scanning: {FolderPath}", folderPath);

            var sectionId = await GetSectionIdForPathAsync(baseFolder);
            logger.LogDebug("Found section ID: {SectionId} for base folder: {BaseFolder}", sectionId, baseFolder);

            var encodedPath = Uri.EscapeDataString(folderPath);
            var url = $"{_options.ApiEndpoint}/library/sections/{sectionId}/refresh?path={encodedPath}&X-Plex-Token={_options.PlexToken}";
            
            logger.LogDebug("Request URL: {Url}", url.Replace(_options.PlexToken, "REDACTED", StringComparison.OrdinalIgnoreCase));

            var response = await httpClient.GetAsync(new Uri(url));
            
            if (response.IsSuccessStatusCode)
            {
                logger.LogInformation("Successfully initiated scan for folder: {FolderPath}", folderPath);
            }
            else
            {
                logger.LogWarning("Failed to initiate Plex scan for folder: {FolderPath}. Status code: {StatusCode}", 
                    folderPath, response.StatusCode);
            }
        }
        catch (HttpRequestException ex)
        {
            logger.LogWarning(ex, "Could not connect to Plex server: {Message}", ex.Message);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to add folder for scanning: {FolderPath}. Error: {Message}", 
                folderPath, ex.Message);
        }
    }

    public async Task DeleteFolderFromPlexAsync(string folderPath)
    {
        try
        {
            logger.LogInformation("Deleting folder from Plex: {FolderPath}", folderPath);

            var sectionId = await GetSectionIdForPathAsync(folderPath);
            logger.LogDebug("Found section ID: {SectionId} for folder: {FolderPath}", sectionId, folderPath);

            var encodedPath = HttpUtility.UrlEncode(folderPath);
            var url = $"{_options.ApiEndpoint}/library/sections/{sectionId}/refresh?path={encodedPath}&X-Plex-Token={_options.PlexToken}&type=1";
            
            logger.LogDebug("Request URL: {Url}", url.Replace(_options.PlexToken, "REDACTED", StringComparison.OrdinalIgnoreCase));

            var response = await httpClient.DeleteAsync(new Uri(url));
            
            if (response.IsSuccessStatusCode)
            {
                logger.LogInformation("Successfully deleted folder from Plex: {FolderPath}", folderPath);
            }
            else
            {
                logger.LogWarning("Failed to delete folder from Plex: {FolderPath}. Status code: {StatusCode}", 
                    folderPath, response.StatusCode);
            }
        }
        catch (HttpRequestException ex)
        {
            logger.LogWarning(ex, "Could not connect to Plex server: {Message}", ex.Message);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed to delete folder from Plex: {FolderPath}. Error: {Message}", 
                folderPath, ex.Message);
        }
    }
} 
