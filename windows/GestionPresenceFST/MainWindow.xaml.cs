using System.Windows;
using Microsoft.Web.WebView2.Core;

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
            Browser.CoreWebView2.NavigationCompleted += OnNavigationCompleted;
            Browser.CoreWebView2.ProcessFailed += OnProcessFailed;
            NavigateOnline();
        }
        catch
        {
            ShowOfflinePanel();
        }
    }

    private void NavigateOnline()
    {
        OfflinePanel.Visibility = Visibility.Collapsed;
        Browser.Source = OnlineHostState.ProductionUrl;
    }

    private void OnNavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e)
    {
        OfflinePanel.Visibility = e.IsSuccess ? Visibility.Collapsed : Visibility.Visible;
    }

    private void OnProcessFailed(object? sender, CoreWebView2ProcessFailedEventArgs e)
    {
        ShowOfflinePanel();
    }

    private void ShowOfflinePanel()
    {
        OfflinePanel.Visibility = Visibility.Visible;
    }

    private void Retry_Click(object sender, RoutedEventArgs e)
    {
        NavigateOnline();
    }
}
