using Microsoft.EntityFrameworkCore;
using PlexLocalScan.Core.Tables;

namespace PlexLocalScan.Data.Data;

public sealed class PlexScanContext : DbContext
{
    public DbSet<ScannedFile> ScannedFiles { get; set; }

    public PlexScanContext(DbContextOptions<PlexScanContext> options)
        : base(options) => ScannedFiles = Set<ScannedFile>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ScannedFile>().HasIndex(f => f.SourceFile);

        modelBuilder.Entity<ScannedFile>().HasIndex(f => f.DestFile);

        modelBuilder
            .Entity<ScannedFile>()
            .HasIndex(f => new
            {
                f.SourceFile,
                f.DestFile,
                f.EpisodeNumber,
            })
            .IsUnique();

        modelBuilder.Entity<ScannedFile>().Property(f => f.Status).HasConversion<string>();

        modelBuilder.Entity<ScannedFile>().Property(f => f.MediaType).HasConversion<string>();

        modelBuilder.Entity<ScannedFile>().Property(f => f.ImdbId).HasConversion<string>();

        modelBuilder.Entity<ScannedFile>().HasIndex(f => f.TmdbId);

        modelBuilder.Entity<ScannedFile>().Property(f => f.SeasonNumber).HasConversion<int>();

        modelBuilder.Entity<ScannedFile>().Property(f => f.CreatedAt).HasConversion<DateTime>();

        modelBuilder.Entity<ScannedFile>().Property(f => f.UpdatedAt).HasConversion<DateTime>();

        modelBuilder.Entity<ScannedFile>().Property(f => f.VersionUpdated).HasConversion<int>();

        modelBuilder.Entity<ScannedFile>().Property(f => f.UpdateToVersion).HasConversion<int>();
    }
}
