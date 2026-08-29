using GestionPresenceFST.Data;
using GestionPresenceFST.Models;

namespace GestionPresenceFST.Sync;

public sealed class ConflictService
{
    private readonly LocalDatabase _database;

    public ConflictService(LocalDatabase database) => _database = database;

    public async Task<long> AddConflictAsync(SyncConflict conflict, CancellationToken ct = default)
    {
        Validate(conflict.AccountId, conflict.Entity, conflict.RecordId);
        await using var connection = _database.OpenConnection();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            insert into sync_conflicts(account_id, entity, record_id, local_json, remote_json, base_updated_at, reason, created_at)
            values($account, $entity, $record, $local, $remote, $base, $reason, $created);
            select last_insert_rowid();
            """;
        command.Parameters.AddWithValue("$account", conflict.AccountId);
        command.Parameters.AddWithValue("$entity", conflict.Entity);
        command.Parameters.AddWithValue("$record", conflict.RecordId);
        command.Parameters.AddWithValue("$local", conflict.LocalJson);
        command.Parameters.AddWithValue("$remote", (object?)conflict.RemoteJson ?? DBNull.Value);
        command.Parameters.AddWithValue("$base", (object?)conflict.BaseUpdatedAt ?? DBNull.Value);
        command.Parameters.AddWithValue("$reason", conflict.Reason);
        command.Parameters.AddWithValue("$created", DateTimeOffset.UtcNow.ToString("O"));
        return Convert.ToInt64(await command.ExecuteScalarAsync(ct));
    }

    public async Task<IReadOnlyList<SyncConflict>> GetOpenAsync(string accountId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(accountId)) throw new ArgumentException("An account id is required.", nameof(accountId));
        var result = new List<SyncConflict>();
        await using var connection = _database.OpenConnection();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            select id, account_id, entity, record_id, local_json, remote_json, base_updated_at, reason
            from sync_conflicts
            where account_id=$account and resolved=0
            order by id;
            """;
        command.Parameters.AddWithValue("$account", accountId);
        await using var reader = await command.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            result.Add(new SyncConflict(
                reader.GetInt64(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetString(3),
                reader.GetString(4),
                reader.IsDBNull(5) ? null : reader.GetString(5),
                reader.IsDBNull(6) ? null : reader.GetString(6),
                reader.GetString(7)));
        }
        return result;
    }

    public async Task<SyncConflict?> GetOpenByIdAsync(long id, CancellationToken ct = default)
    {
        await using var connection = _database.OpenConnection();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            select id, account_id, entity, record_id, local_json, remote_json, base_updated_at, reason
            from sync_conflicts where id=$id and resolved=0;
            """;
        command.Parameters.AddWithValue("$id", id);
        await using var reader = await command.ExecuteReaderAsync(ct);
        if (!await reader.ReadAsync(ct)) return null;
        return new SyncConflict(
            reader.GetInt64(0), reader.GetString(1), reader.GetString(2), reader.GetString(3),
            reader.GetString(4), reader.IsDBNull(5) ? null : reader.GetString(5),
            reader.IsDBNull(6) ? null : reader.GetString(6), reader.GetString(7));
    }

    public async Task MarkResolvedAsync(long id, CancellationToken ct = default)
    {
        await using var connection = _database.OpenConnection();
        await using var command = connection.CreateCommand();
        command.CommandText = "update sync_conflicts set resolved=1 where id=$id;";
        command.Parameters.AddWithValue("$id", id);
        await command.ExecuteNonQueryAsync(ct);
    }

    private static void Validate(string accountId, string entity, string recordId)
    {
        if (string.IsNullOrWhiteSpace(accountId)) throw new ArgumentException("An account id is required.", nameof(accountId));
        SyncEntities.EnsureAllowed(entity);
        if (string.IsNullOrWhiteSpace(recordId)) throw new ArgumentException("A record id is required.", nameof(recordId));
    }
}
