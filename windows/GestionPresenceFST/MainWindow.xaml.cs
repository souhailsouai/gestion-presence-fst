using System;
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
        try
        {
            await Browser.EnsureCoreWebView2Async();
            Browser.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            Browser.CoreWebView2.Settings.IsZoomControlEnabled = false;
            var htmlPath = EmbeddedAppHost.WriteLocalHtml();
            Browser.Source = new Uri(htmlPath);
        }
        catch
        {
            MessageBox.Show(
                "Impossible d'ouvrir l'application. Vérifiez que Microsoft Edge WebView2 Runtime est installé.",
                "Gestion Présence FST",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
        }
    }
}
