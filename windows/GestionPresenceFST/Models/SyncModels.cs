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

public enum SyncOperation
{
    Insert,
    Update,
    Delete
}

public sealed record PendingOperation(
    long Id,
    string AccountId,
    string Entity,
    string RecordId,
    SyncOperation Operation,
    string PayloadJson,
    string? BaseUpdatedAt,
    int RetryCount,
    bool Retryable,
    string? LastError);

public sealed record SyncConflict(
    long Id,
    string AccountId,
    string Entity,
    string RecordId,
    string LocalJson,
    string? RemoteJson,
    string? BaseUpdatedAt,
    string Reason);

public sealed record RemoteWriteResult(
    bool Applied,
    string? ReturnedJson,
    bool Conflict,
    int StatusCode,
    string? Error);
