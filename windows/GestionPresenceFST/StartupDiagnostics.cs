using System;
using System.IO;

namespace GestionPresenceFST;

public static class StartupDiagnostics
{
    public static string GetLogPath()
    {
        var folder = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "GestionPresenceFST");
        return Path.Combine(folder, "startup.log");
    }

    public static string Format(Exception exception)
        => $"[{DateTimeOffset.Now:O}] {exception.GetType().FullName}: {exception.Message}{Environment.NewLine}{exception}";

    public static void Write(Exception exception)
    {
        try
        {
            var path = GetLogPath();
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            File.AppendAllText(path, Format(exception) + Environment.NewLine + Environment.NewLine);
        }
        catch
        {
            // Diagnostics must never hide the original startup error.
        }
    }
}
