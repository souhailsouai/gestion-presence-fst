using Xunit;

namespace GestionPresenceFST.Tests.Architecture;

public sealed class NativeProjectTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !Directory.Exists(Path.Combine(dir.FullName, "windows", "GestionPresenceFST")))
            dir = dir.Parent;
        return dir?.FullName ?? throw new InvalidOperationException("Repository root not found.");
    }

    [Fact]
    public void Project_contains_no_webview_or_embedded_web_assets()
    {
        var root = RepoRoot();
        var csproj = File.ReadAllText(Path.Combine(root, "windows", "GestionPresenceFST", "GestionPresenceFST.csproj"));
        Assert.DoesNotContain("WebView2", csproj, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("web\\index.html", csproj, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("fst_patch", csproj, StringComparison.OrdinalIgnoreCase);

        var source = string.Join("\n", Directory.EnumerateFiles(Path.Combine(root, "windows", "GestionPresenceFST"), "*.*", SearchOption.AllDirectories)
            .Where(p => p.EndsWith(".cs", StringComparison.OrdinalIgnoreCase) || p.EndsWith(".xaml", StringComparison.OrdinalIgnoreCase))
            .Select(File.ReadAllText));
        Assert.DoesNotContain("WebView2", source, StringComparison.OrdinalIgnoreCase);
    }
}
