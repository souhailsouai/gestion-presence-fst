using System.Text.RegularExpressions;
using GestionPresenceFST.Data;
using GestionPresenceFST.Infrastructure;
using GestionPresenceFST.Security;

namespace GestionPresenceFST.Services;

public sealed class AuthService : IAuthService
{
    private readonly ISupabaseGateway _gateway;
    private readonly ISessionStore _store;

    public AuthService(ISupabaseGateway gateway, ISessionStore store)
    {
        _gateway = gateway;
        _store = store;
    }

    public static string NormalizeUsername(string value) => Regex.Replace((value ?? "").Trim().ToLowerInvariant(), "[^a-z0-9._-]", "");
    public static string TeacherAuthEmail(string username) => NormalizeUsername(username) + "@" + AppConfig.TeacherAuthDomain;

    public async Task<AuthResult> SignInAsync(string username, string credential, LoginMode mode, CancellationToken ct = default)
    {
        username = NormalizeUsername(username);
        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(credential))
            return AuthResult.Fail(mode, "Saisissez votre identifiant et votre mot de passe ou PIN.");

        await _gateway.InitializeAsync(ct);
        AuthTokens? tokens;
        if (mode == LoginMode.Admin)
        {
            tokens = await _gateway.SignInWithPinAsync(username, credential, ct);
        }
        else
        {
            tokens = await _gateway.SignInWithPasswordAsync(TeacherAuthEmail(username), credential, ct);
        }

        if (tokens is null)
            return AuthResult.Fail(mode, "Identifiant, mot de passe ou PIN incorrect.");

        var profile = await _gateway.GetProfileAsync(tokens.UserId, ct);
        if (profile is null)
        {
            await _gateway.SignOutAsync(ct);
            return AuthResult.Fail(mode, "Profil utilisateur introuvable.");
        }
        if (mode == LoginMode.Admin && !profile.IsAdmin)
        {
            await _gateway.SignOutAsync(ct);
            return AuthResult.Fail(mode, "Ce compte ne possède pas les droits administrateur.");
        }

        await _store.SaveAsync(tokens, ct);
        return new AuthResult(true, profile, tokens, mode, null);
    }

    public async Task<AuthResult?> RestoreAsync(CancellationToken ct = default)
    {
        var stored = await _store.LoadAsync(ct);
        if (stored is null) return null;
        var tokens = await _gateway.RestoreSessionAsync(stored, ct);
        if (tokens is null)
        {
            await _store.ClearAsync(ct);
            return null;
        }
        var profile = await _gateway.GetProfileAsync(tokens.UserId, ct);
        if (profile is null)
        {
            await SignOutAsync(ct);
            return null;
        }
        await _store.SaveAsync(tokens, ct);
        return new AuthResult(true, profile, tokens, LoginMode.Teacher, null);
    }

    public async Task SignOutAsync(CancellationToken ct = default)
    {
        try { await _gateway.SignOutAsync(ct); }
        finally { await _store.ClearAsync(ct); }
    }
}
