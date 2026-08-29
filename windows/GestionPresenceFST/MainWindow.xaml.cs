using System;
using System.IO;
using System.Windows;
namespace GestionPresenceFST {
 public partial class MainWindow : Window {
  public MainWindow(){ InitializeComponent(); Loaded += OnLoaded; }
  private async void OnLoaded(object sender, RoutedEventArgs e){
   await Browser.EnsureCoreWebView2Async();
   var html = Path.Combine(AppContext.BaseDirectory, "web", "index.html");
   if(!File.Exists(html)){ MessageBox.Show("Le fichier de l'application est introuvable.", "Gestion Présence FST", MessageBoxButton.OK, MessageBoxImage.Error); Close(); return; }
   Browser.CoreWebView2.Settings.AreDevToolsEnabled = false;
   Browser.CoreWebView2.Settings.IsZoomControlEnabled = false;
   Browser.Source = new Uri(html);
  }
 }
}