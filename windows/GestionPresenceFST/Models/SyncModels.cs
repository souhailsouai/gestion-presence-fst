namespace GestionPresenceFST.Models;

public static class SyncEntities
{
    private static readonly HashSet<string> Allowed = new(StringComparer.Ordinal)
    {
        "classes",
        "students",
        "sessions",
        "attendance"
    };

    public static IReadOnlyList<string> All { get; } = new[]
    {
        "classes",
        "students",
        "sessions",
        "attendance"
    };

    public static bool IsAllowed(string entity) => Allowed.Contains(entity);

    public static void EnsureAllowed(string entity)
    {
        if (!IsAllowed(entity))
            throw new ArgumentOutOfRangeException(nameof(entity), entity, "Entity is not available for offline synchronization.");
    }
}
