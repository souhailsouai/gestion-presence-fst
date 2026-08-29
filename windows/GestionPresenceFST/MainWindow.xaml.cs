using System;
using System.IO;
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
        var html = Path.Combine(AppContext.BaseDirectory, "web", "index.html");
        Browser.Source = new Uri(html);
    }
}
