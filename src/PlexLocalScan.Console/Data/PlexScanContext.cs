using Microsoft.EntityFrameworkCore;
using PlexLocalScan.Models;

namespace PlexLocalScan.Data;

public class PlexScanContext : DbContext
{
    public DbSet<ScannedFile> ScannedFiles { get; set; } = null!;

    public PlexScanContext(DbContextOptions<PlexScanContext> options)
        : base(options)
    {
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
    }
} 