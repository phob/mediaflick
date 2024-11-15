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
    }
}
