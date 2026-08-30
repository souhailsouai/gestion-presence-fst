namespace GestionPresenceFSTOnline;

public static class StartupDiagnostics
{
    public static string GetLogPath() => Path.Combine(EmbeddedAppHost.GetApplicationFolder(), "startup.log");

    public static void Write(Exception exception)
    {
        try
        {
            File.AppendAllText(
                GetLogPath(),
                $"[{DateTimeOffset.Now:O}] {exception.GetType().FullName}: {exception.Message}{Environment.NewLine}{exception}{Environment.NewLine}{Environment.NewLine}");
        }
        catch
        {
            // Diagnostics must never hide the original startup failure.
        }
    }
}
