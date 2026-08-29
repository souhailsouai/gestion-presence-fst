using System.Reflection;
using System.Text;

namespace GestionPresenceFST;

public static class EmbeddedAppHost
{
    public const string HtmlResourceName = "GestionPresenceFST.web.index.html";

    public static string LoadHtml()
    {
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(HtmlResourceName)
            ?? throw new InvalidOperationException($"Ressource HTML introuvable: {HtmlResourceName}");
        using var reader = new StreamReader(stream, Encoding.UTF8);
        return reader.ReadToEnd();
    }

    public static string GetLocalHtmlPath()
    {
        var folder = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "GestionPresenceFST");
        return Path.Combine(folder, "index.html");
    }

    public static string WriteLocalHtml()
    {
        var path = GetLocalHtmlPath();
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        File.WriteAllText(path, LoadHtml(), new UTF8Encoding(false));
        return path;
    }
}
