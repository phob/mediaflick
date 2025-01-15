using Microsoft.EntityFrameworkCore;
using PlexLocalScan.Data.Data;

namespace PlexLocalScan.Api.Loader;

internal sealed class DatabaseSettingsLoader(PlexScanContext dbContext)
{
    public async Task<PlexDbOptions> LoadPlexOptionsAsync() =>
        await dbContext.PlexDbOptions
            .Include(po => po.FolderMappings)
            .FirstOrDefaultAsync() ?? new PlexDbOptions();

    public async Task<TmDbDbOptions> LoadTmDbOptionsAsync() => await dbContext.TmDbDbOptions.FirstOrDefaultAsync() ?? new TmDbDbOptions();

    public async Task<MediaDetectionDbOptions> LoadMediaDetectionOptionsAsync()
    {
        MediaDetectionDbOptions? options = await dbContext.MediaDetectionDbOptions.FirstOrDefaultAsync();
        return options ?? new MediaDetectionDbOptions { CacheDurationSeconds = (int)TimeSpan.FromHours(24).TotalSeconds };
    }
}
