using System.Windows;
using GestionPresenceFST.Infrastructure;
using GestionPresenceFST.Windows;

namespace GestionPresenceFST;

public partial class App : Application
{
    public static AppServices Services { get; private set; } = null!;

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        Services = AppComposition.Build();
        new LoginWindow().Show();
    }
}
