using System.Text.Json;
using GestionPresenceFST.Models;

namespace GestionPresenceFST.Data;

public sealed class LocalDataService
{
    private readonly LocalDatabase _database;

    public LocalDataService(LocalDatabase database) => _database = database;

    public async Task UpsertSnapshotAsync(string accountId, string entity, JsonElement record, CancellationToken ct = default)
    {
        EnsureAccount(accountId);
        SyncEntities.EnsureAllowed(entity);

        if (!record.TryGetProperty("id", out var idProperty) || string.IsNullOrWhiteSpace(idProperty.GetString()))
            throw new ArgumentException("The synchronized record must contain a non-empty id.", nameof(record));

        var recordId = idProperty.GetString()!;
        string? remoteUpdatedAt = null;
        if (record.TryGetProperty("updated_at", out var updatedAt) && updatedAt.ValueKind != JsonValueKind.Null)
            remoteUpdatedAt = updatedAt.GetString();

        await using var connection = _database.OpenConnection();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            insert into local_records(account_id, entity, record_id, json, remote_updated_at, local_updated_at, sync_state)
            values($account, $entity, $id, $json, $remote, $local, 'synced')
            on conflict(account_id, entity, record_id) do update set
              json = excluded.json,
              remote_updated_at = excluded.remote_updated_at,
              local_updated_at = excluded.local_updated_at,
              sync_state = 'synced';
            """;
        command.Parameters.AddWithValue("$account", accountId);
        command.Parameters.AddWithValue("$entity", entity);
        command.Parameters.AddWithValue("$id", recordId);
        command.Parameters.AddWithValue("$json", record.GetRawText());
        command.Parameters.AddWithValue("$remote", (object?)remoteUpdatedAt ?? DBNull.Value);
        command.Parameters.AddWithValue("$local", DateTimeOffset.UtcNow.ToString("O"));
        await command.ExecuteNonQueryAsync(ct);
    }

    public async Task<IReadOnlyList<JsonDocument>> GetSnapshotAsync(string accountId, string entity, CancellationToken ct = default)
    {
        EnsureAccount(accountId);
        SyncEntities.EnsureAllowed(entity);

        var result = new List<JsonDocument>();
        await using var connection = _database.OpenConnection();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            select json
            from local_records
            where account_id = $account and entity = $entity
            order by record_id;
            """;
        command.Parameters.AddWithValue("$account", accountId);
        command.Parameters.AddWithValue("$entity", entity);
        await using var reader = await command.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
            result.Add(JsonDocument.Parse(reader.GetString(0)));
        return result;
    }

    public async Task RemoveSnapshotAsync(string accountId, string entity, string recordId, CancellationToken ct = default)
    {
        EnsureAccount(accountId);
        SyncEntities.EnsureAllowed(entity);
        if (string.IsNullOrWhiteSpace(recordId)) throw new ArgumentException("A record id is required.", nameof(recordId));

        await using var connection = _database.OpenConnection();
        await using var command = connection.CreateCommand();
        command.CommandText = "delete from local_records where account_id = $account and entity = $entity and record_id = $id;";
        command.Parameters.AddWithValue("$account", accountId);
        command.Parameters.AddWithValue("$entity", entity);
        command.Parameters.AddWithValue("$id", recordId);
        await command.ExecuteNonQueryAsync(ct);
    }

    private static void EnsureAccount(string accountId)
    {
        if (string.IsNullOrWhiteSpace(accountId))
            throw new ArgumentException("An authenticated account id is required.", nameof(accountId));
    }
}
