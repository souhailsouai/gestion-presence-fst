using GestionPresenceFST;
using Xunit;

namespace GestionPresenceFST.Tests;

public class OnlineHostStateTests
{
    [Fact]
    public void EmbeddedHtmlContainsOnlineRuntimeWithoutPublicHosting()
    {
        var html = EmbeddedAppHost.LoadHtml();

        Assert.Contains("window.FSTOnlineRuntime=", html);
        Assert.Contains("Connexion Internet requise", html);
        Assert.DoesNotContain("souhailsouai.github.io", html);
        Assert.DoesNotContain("./online-runtime.js", html);
    }

    [Fact]
    public void LocalHtmlIsWrittenUnderPrivateUserDataDirectory()
    {
        var path = EmbeddedAppHost.GetLocalHtmlPath();

        Assert.EndsWith("GestionPresenceFST\\index.html", path.Replace('/', '\\'));
    }
}
