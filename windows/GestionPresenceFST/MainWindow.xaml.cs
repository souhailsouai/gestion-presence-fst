using System;
using System.IO;
using System.Reflection;
using System.Windows;

namespace GestionPresenceFST;

public partial class MainWindow : Window
{
    private const string HtmlResourceName = "GestionPresenceFST.web.index.html";

    public MainWindow()
    {
        InitializeComponent();
        Loaded += OnLoaded;
    }

    private static string ExtractEmbeddedHtml()
    {
        var appDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "GestionPresenceFST",
            "2026-2027");
        Directory.CreateDirectory(appDir);
        var htmlPath = Path.Combine(appDir, "index.html");

        using var source = Assembly.GetExecutingAssembly().GetManifestResourceStream(HtmlResourceName)
            ?? throw new InvalidOperationException($"Embedded resource '{HtmlResourceName}' was not found.");
        using var target = File.Create(htmlPath);
        source.CopyTo(target);
        return htmlPath;
    }

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        await Browser.EnsureCoreWebView2Async();
        Browser.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
        Browser.CoreWebView2.Settings.IsZoomControlEnabled = false;
        Browser.Source = new Uri(ExtractEmbeddedHtml());
    }
}
