using System;
using System.IO;
using System.Text.Json;
using System.Windows;

namespace GestionPresenceFST;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        Loaded += OnLoaded;
    }

    private async void OnLoaded(object sender, RoutedEventArgs e)
    {
        await Browser.EnsureCoreWebView2Async();
        Browser.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
        Browser.CoreWebView2.Settings.IsZoomControlEnabled = false;
        Browser.CoreWebView2.NavigationCompleted += async (_, args) =>
        {
            if (!args.IsSuccess) return;
            try
            {
                var webDir = Path.Combine(AppContext.BaseDirectory, "web");
                var css = await File.ReadAllTextAsync(Path.Combine(webDir, "fst_patch.css"));
                var js = await File.ReadAllTextAsync(Path.Combine(webDir, "fst_patch.js"));
                var cssLiteral = JsonSerializer.Serialize(css);
                await Browser.CoreWebView2.ExecuteScriptAsync($"(() => {{ const s=document.createElement('style'); s.setAttribute('data-fst-shared-patch','css'); s.textContent={cssLiteral}; document.head.appendChild(s); }})();");
                await Browser.CoreWebView2.ExecuteScriptAsync(js);
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Impossible de charger le correctif applicatif : {ex.Message}", "Gestion Présence FST", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        };
        var html = Path.Combine(AppContext.BaseDirectory, "web", "index.html");
        Browser.Source = new Uri(html);
    }
}
