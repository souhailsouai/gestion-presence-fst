using System;

namespace GestionPresenceFST;

public static class OnlineHostState
{
    public static readonly Uri ProductionUrl = new("https://souhailsouai.github.io/gestion-presence-fst/");
    public const string OfflineTitle = "Connexion Internet requise";
    public const string OfflineMessage = "Impossible d’accéder à l’application en ligne. Vérifiez votre connexion Internet puis réessayez.";
}
