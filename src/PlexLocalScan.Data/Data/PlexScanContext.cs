using Microsoft.EntityFrameworkCore;
using PlexLocalScan.Data.Models;

namespace PlexLocalScan.Data.Data;

public class PlexScanContext : DbContext
{
    public DbSet<ScannedFile> ScannedFiles { get; set; }
    
    public PlexScanContext(DbContextOptions<PlexScanContext> options)
        : base(options)
    {
        ScannedFiles = Set<ScannedFile>();
    }
    
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ScannedFile>()
            .HasIndex(f => f.SourceFile)
            .IsUnique();
            
        modelBuilder.Entity<ScannedFile>()
            .HasIndex(f => f.DestFile)
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
            .Property(f => f.TmdbId)
            .HasConversion<int>();

        modelBuilder.Entity<ScannedFile>()
            .Property(f => f.SeasonNumber)
            .HasConversion<int>();

        modelBuilder.Entity<ScannedFile>()
            .Property(f => f.EpisodeNumber)
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