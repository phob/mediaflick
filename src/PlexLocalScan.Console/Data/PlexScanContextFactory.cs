using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace PlexLocalScan.Console.Data;

public class PlexScanContextFactory : IDesignTimeDbContextFactory<PlexScanContext>
{
    public PlexScanContext CreateDbContext(string[] args)
    {
        var optionsBuilder = new DbContextOptionsBuilder<PlexScanContext>();
        optionsBuilder.UseSqlite("Data Source=plexscan.db"); // Adjust connection string as needed

        return new PlexScanContext(optionsBuilder.Options);
    }
} 