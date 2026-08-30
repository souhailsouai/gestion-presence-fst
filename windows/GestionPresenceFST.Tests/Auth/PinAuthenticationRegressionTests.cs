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
    public void Pin_sign_in_must_use_supabase_auth_password_not_local_profile_hash()
    {
        var root = RepoRoot();
        var authServicePath = Path.Combine(root, "windows", "GestionPresenceFST", "Services", "AuthService.cs");
        var source = File.ReadAllText(authServicePath);

        Assert.DoesNotContain("SHA256.HashData", source, StringComparison.Ordinal);
        Assert.DoesNotContain("pin_hash=eq", source, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("SignInWithPasswordAsync", source, StringComparison.Ordinal);
    }
}
