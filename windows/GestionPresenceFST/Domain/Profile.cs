namespace GestionPresenceFST.Domain;
public sealed record Profile(string Id, string Email, string Username, string FullName, string Role)
{
    public bool IsAdmin => string.Equals(Role, "admin", StringComparison.OrdinalIgnoreCase);
}
