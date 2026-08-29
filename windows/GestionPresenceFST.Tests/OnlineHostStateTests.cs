using GestionPresenceFST;
using Xunit;

namespace GestionPresenceFST.Tests;

public class OnlineHostStateTests
{
    [Fact]
    public void ProductionUrlIsTheApprovedGitHubPagesUrl()
    {
        Assert.Equal("https://souhailsouai.github.io/gestion-presence-fst/", OnlineHostState.ProductionUrl.AbsoluteUri);
    }

    [Fact]
    public void OfflineMessageIsExplicit()
    {
        Assert.Equal("Connexion Internet requise", OnlineHostState.OfflineTitle);
    }
}
