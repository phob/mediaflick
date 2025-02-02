namespace PlexLocalScan.Core.Helper;

public static class SymlinkHelper
{
    private static readonly string[] SourceArray = [".mkv", ".mp4", ".avi"];

    public static bool IsSymlink(string path)
    {
        if (!File.Exists(path))
        {
            return false;
        }

        var fileInfo = new FileInfo(path);
        return fileInfo.Attributes.HasFlag(FileAttributes.ReparsePoint);
    }

    public static bool IsVideoFile(string extension) =>
        SourceArray.Contains(extension.ToLower(System.Globalization.CultureInfo.CurrentCulture));

    public static async Task<bool> CreateFileLinkAsync(string sourcePath, string destinationPath)
    {
        try
        {
            if (await Task.Run(() => File.Exists(destinationPath)))
            {
                await Task.Run(() => File.Delete(destinationPath));
            }

            await Task.Run(() => File.CreateSymbolicLink(destinationPath, sourcePath));
            return true;
        }
        catch (Exception)
        {
            return false;
        }
    }
}
