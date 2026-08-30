using GestionPresenceFST;
using Xunit;

namespace GestionPresenceFST.Tests;

public class StartupDiagnosticsTests
{
    [Fact]
    public void LogPathLivesUnderLocalApplicationData()
    {
        var path = StartupDiagnostics.GetLogPath();
        Assert.Contains("GestionPresenceFST", path);
        Assert.EndsWith("startup.log", path);
    }

    [Fact]
    public void FormatIncludesExceptionTypeAndMessage()
    {
        var text = StartupDiagnostics.Format(new InvalidOperationException("boom"));
        Assert.Contains("InvalidOperationException", text);
        Assert.Contains("boom", text);
    }
}
