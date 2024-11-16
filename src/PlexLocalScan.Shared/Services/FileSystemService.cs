using PlexLocalScan.Shared.Interfaces;

namespace PlexLocalScan.Shared.Services;

public class FileSystemService : IFileSystemService
{
    public string GetFileName(string path) => Path.GetFileName(path);
} 