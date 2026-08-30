using System.Windows;

namespace GestionPresenceFST.Windows;

public partial class LoginWindow : Window
{
    public LoginWindow() => InitializeComponent();

    private void LoginButton_Click(object sender, RoutedEventArgs e)
    {
        StatusText.Text = "Le service d’authentification sera activé dans l’étape suivante.";
    }
}
