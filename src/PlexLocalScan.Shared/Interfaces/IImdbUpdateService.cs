namespace PlexLocalScan.Shared.Interfaces;

public interface IImdbUpdateService
{
    /// <summary>
    /// Updates missing IMDb IDs for entries that have TMDb IDs
    /// </summary>
    /// <param name="batchSize">Number of entries to process in each batch</param>
    /// <returns>Tuple containing the count of (updated, failed) entries</returns>
    Task<(int updated, int failed)> UpdateMissingImdbIdsAsync(int batchSize = 50);
} 