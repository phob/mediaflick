using Microsoft.EntityFrameworkCore;
using PlexLocalScan.Core.Tables;

namespace PlexLocalScan.Data.Data;

public sealed class PlexScanContext(DbContextOptions<PlexScanContext> options) : DbContext(options)
{
    public DbSet<ScannedFile> ScannedFiles { get; set; } = null!;
    public DbSet<PlexDbOptions> PlexDbOptions { get; set; } = null!;
    public DbSet<FolderMappingDbOptions> FolderDbMappings { get; set; } = null!;
    public DbSet<TmDbDbOptions> TmDbDbOptions { get; set; } = null!;
    public DbSet<MediaDetectionDbOptions> MediaDetectionDbOptions { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        
        
        // PlexOptions configuration
        modelBuilder.Entity<PlexDbOptions>()
            .HasKey(po => po.Id);

        modelBuilder.Entity<PlexDbOptions>()
            .HasMany(po => po.FolderMappings)
            .WithOne(fm => fm.PlexOptions)
            .HasForeignKey(fm => fm.LinkedPlexOptionsId);

        // FolderMappingOptions configuration
        modelBuilder.Entity<FolderMappingDbOptions>()
            .HasKey(fm => fm.Id);

        modelBuilder.Entity<FolderMappingDbOptions>()
            .Property(fm => fm.MediaType)
            .HasConversion<string>();

        // TmDbOptions configuration
        modelBuilder.Entity<TmDbDbOptions>()
            .HasKey(tm => tm.Id);

        // MediaDetectionOptions configuration
        modelBuilder.Entity<MediaDetectionDbOptions>()
            .HasKey(md => md.Id);
        
        // ScannedFiles
        modelBuilder.Entity<ScannedFile>()
            .HasIndex(f => f.SourceFile);

        modelBuilder.Entity<ScannedFile>()
            .HasIndex(f => f.DestFile);

        modelBuilder.Entity<ScannedFile>()
            .HasIndex(f => new { f.SourceFile, f.DestFile, f.EpisodeNumber })
            .IsUnique();

        modelBuilder.Entity<ScannedFile>()
            .Property(f => f.Status)
            .HasConversion<string>();

        modelBuilder.Entity<ScannedFile>()
            .Property(f => f.MediaType)
            .HasConversion<string>();

        modelBuilder.Entity<ScannedFile>()
            .Property(f => f.ImdbId)
            .HasConversion<string>();

        modelBuilder.Entity<ScannedFile>()
            .HasIndex(f => f.TmdbId);

        modelBuilder.Entity<ScannedFile>()
            .Property(f => f.SeasonNumber)
            .HasConversion<int>();

        modelBuilder.Entity<ScannedFile>()
            .Property(f => f.CreatedAt)
            .HasConversion<DateTime>();

        modelBuilder.Entity<ScannedFile>()
            .Property(f => f.UpdatedAt)
            .HasConversion<DateTime>();

        modelBuilder.Entity<ScannedFile>()
            .Property(f => f.VersionUpdated)
            .HasConversion<int>();

        modelBuilder.Entity<ScannedFile>()
            .Property(f => f.UpdateToVersion)
            .HasConversion<int>();
    }
}
