using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using PlexLocalScan.Core.Tables;

namespace PlexLocalScan.Data.Data;

public class FolderMappingDbOptions
{
    private const string DefaultFolderPath = "";
    [Key]
    public int Id { get; set; }

    [ForeignKey("PlexOptions")]
    public int LinkedPlexOptionsId { get; set; }

    [MaxLength(255)]
    public string SourceFolder { get; set; } = DefaultFolderPath;

    [MaxLength(255)]
    public string DestinationFolder { get; set; } = DefaultFolderPath;

    public MediaType MediaType { get; set; }

    public PlexDbOptions? PlexOptions { get; init; }
}
