using System.Windows;
using Microsoft.Web.WebView2.Core;

namespace GestionPresenceFSTOnline;

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
            var userDataFolder = EmbeddedAppHost.GetWebViewDataFolder();
            var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: userDataFolder);
            await Browser.EnsureCoreWebView2Async(environment);
            Browser.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            Browser.CoreWebView2.Settings.AreDevToolsEnabled = false;
            Browser.CoreWebView2.Settings.IsStatusBarEnabled = false;
            Browser.CoreWebView2.Settings.IsZoomControlEnabled = true;
            Browser.CoreWebView2.Settings.IsPasswordAutosaveEnabled = false;
            Browser.CoreWebView2.Settings.IsGeneralAutofillEnabled = false;
            Browser.CoreWebView2.AddWebResourceRequestedFilter("http://*", CoreWebView2WebResourceContext.All);
            Browser.CoreWebView2.WebResourceRequested += (_, args) =>
            {
                if (args.Request.Uri.StartsWith("http://", StringComparison.OrdinalIgnoreCase))
                {
                    args.Response = Browser.CoreWebView2.Environment.CreateWebResourceResponse(null, 403, "HTTPS Required", "Content-Type: text/plain");
                }
            };
            Browser.Source = new Uri(EmbeddedAppHost.WriteLocalHtml());
        }
        catch (Exception exception)
        {
            StartupDiagnostics.Write(exception);
            MessageBox.Show(
                "Impossible d'ouvrir l'application. Vérifiez que Microsoft Edge WebView2 Runtime est installé.",
                "Gestion Présence FST",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
        }
    }
}
