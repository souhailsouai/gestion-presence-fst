using System.Windows;
using System.Windows.Threading;

namespace GestionPresenceFSTOnline;

public partial class App : Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        DispatcherUnhandledException += OnDispatcherUnhandledException;
        try
        {
            MainWindow = new MainWindow();
            MainWindow.Show();
        }
        catch (Exception exception)
        {
            ReportStartupFailure(exception);
            Shutdown(-1);
        }
    }

    private void OnDispatcherUnhandledException(object sender, DispatcherUnhandledExceptionEventArgs e)
    {
        StartupDiagnostics.Write(e.Exception);
        MessageBox.Show(
            $"L'application a rencontré une erreur.\n\nJournal : {StartupDiagnostics.GetLogPath()}",
            "Gestion Présence FST",
            MessageBoxButton.OK,
            MessageBoxImage.Error);
        e.Handled = true;
        Shutdown(-1);
    }

    private static void ReportStartupFailure(Exception exception)
    {
        StartupDiagnostics.Write(exception);
        MessageBox.Show(
            $"Impossible d'ouvrir l'application.\n\nJournal : {StartupDiagnostics.GetLogPath()}",
            "Gestion Présence FST",
            MessageBoxButton.OK,
            MessageBoxImage.Error);
    }
}
