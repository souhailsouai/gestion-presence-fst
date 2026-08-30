using System.Text.RegularExpressions;
using Xunit;

namespace GestionPresenceFST.Tests.Auth;

public sealed class PinAuthenticationRegressionTests
{
    private static string RepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !Directory.Exists(Path.Combine(dir.FullName, "windows", "GestionPresenceFST")))
            dir = dir.Parent;
        return dir?.FullName ?? throw new InvalidOperationException("Repository root not found.");
    }

    [Fact]
    public void Windows_auth_must_match_the_final_application_backend_and_login_paths()
    {
        var root = RepoRoot();
        var auth = File.ReadAllText(Path.Combine(root, "windows", "GestionPresenceFST", "Services", "AuthService.cs"));
        var config = File.ReadAllText(Path.Combine(root, "windows", "GestionPresenceFST", "Infrastructure", "AppConfig.cs"));

        Assert.Contains("https://dbslzmvzbxczpqyektpx.supabase.co", config, StringComparison.Ordinal);
        Assert.Contains("sb_publishable_wKwmPnXS_Q7REGU57hTIyw_eqxhIXLT", config, StringComparison.Ordinal);
        Assert.Equal(1, Regex.Matches(auth, @"SignInWithPinAsync\(").Count);
        Assert.Contains("tokens = await _gateway.SignInWithPasswordAsync(TeacherAuthEmail(username), credential, ct);", auth, StringComparison.Ordinal);
    }
}
