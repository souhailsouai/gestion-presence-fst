using System;
using System.IO;
using System.Reflection;
using System.Text;

namespace GestionPresenceFSTOnline;

public static class EmbeddedAppHost
{
    public const string HtmlResourceName = "GestionPresenceFSTOnline.web.index.html";

    public static string LoadHtml()
    {
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(HtmlResourceName)
            ?? throw new InvalidOperationException($"Ressource HTML introuvable: {HtmlResourceName}");
        using var reader = new StreamReader(stream, Encoding.UTF8);
        return reader.ReadToEnd();
    }

    public static string GetApplicationFolder()
    {
        var folder = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "GestionPresenceFST",
            "v2");
        Directory.CreateDirectory(folder);
        return folder;
    }

    public static string GetWebViewDataFolder()
    {
        var folder = Path.Combine(GetApplicationFolder(), "WebView2");
        Directory.CreateDirectory(folder);
        return folder;
    }

    public static string WriteLocalHtml()
    {
        var path = Path.Combine(GetApplicationFolder(), "index.html");
        File.WriteAllText(path, LoadHtml(), new UTF8Encoding(false));
        return path;
    }
}
