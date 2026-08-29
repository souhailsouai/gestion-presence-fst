using GestionPresenceFST.Data;
using GestionPresenceFST.Models;

namespace GestionPresenceFST.Sync;

public sealed class SyncQueueService
{
    private readonly LocalDatabase _database;

    public SyncQueueService(LocalDatabase database) => _database = database;

    public async Task<long> EnqueueAsync(
        string accountId,
        string entity,
        string recordId,
        SyncOperation operation,
        string payloadJson,
        string? baseUpdatedAt,
        CancellationToken ct = default)
    {
        Validate(accountId, entity, recordId);
        await using var connection = _database.OpenConnection();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            insert into sync_queue(account_id, entity, record_id, operation, payload_json, base_updated_at, created_at)
            values($account, $entity, $record, $operation, $payload, $base, $created);
            select last_insert_rowid();
            """;
        command.Parameters.AddWithValue("$account", accountId);
        command.Parameters.AddWithValue("$entity", entity);
        command.Parameters.AddWithValue("$record", recordId);
        command.Parameters.AddWithValue("$operation", operation.ToString().ToLowerInvariant());
        command.Parameters.AddWithValue("$payload", payloadJson ?? "{}");
        command.Parameters.AddWithValue("$base", (object?)baseUpdatedAt ?? DBNull.Value);
        command.Parameters.AddWithValue("$created", DateTimeOffset.UtcNow.ToString("O"));
        return Convert.ToInt64(await command.ExecuteScalarAsync(ct));
    }

    public async Task<IReadOnlyList<PendingOperation>> GetPendingAsync(string accountId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(accountId)) throw new ArgumentException("An account id is required.", nameof(accountId));
        var result = new List<PendingOperation>();
        await using var connection = _database.OpenConnection();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            select id, account_id, entity, record_id, operation, payload_json, base_updated_at, retry_count, retryable, last_error
            from sync_queue
            where account_id = $account and retryable = 1
            order by id;
            """;
        command.Parameters.AddWithValue("$account", accountId);
        await using var reader = await command.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            result.Add(new PendingOperation(
                reader.GetInt64(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetString(3),
                Enum.Parse<SyncOperation>(reader.GetString(4), true),
                reader.GetString(5),
                reader.IsDBNull(6) ? null : reader.GetString(6),
                reader.GetInt32(7),
                reader.GetInt32(8) == 1,
                reader.IsDBNull(9) ? null : reader.GetString(9)));
        }
        return result;
    }

    public async Task MarkSucceededAsync(long operationId, CancellationToken ct = default)
    {
        await DeleteByIdAsync(operationId, ct);
    }

    public async Task MarkFailedAsync(long operationId, string error, bool retryable, CancellationToken ct = default)
    {
        await using var connection = _database.OpenConnection();
        await using var command = connection.CreateCommand();
        command.CommandText = """
            update sync_queue
            set retry_count = retry_count + 1,
                last_error = $error,
                retryable = $retryable
            where id = $id;
            """;
        command.Parameters.AddWithValue("$error", error ?? "sync_error");
        command.Parameters.AddWithValue("$retryable", retryable ? 1 : 0);
        command.Parameters.AddWithValue("$id", operationId);
        await command.ExecuteNonQueryAsync(ct);
    }

    public async Task RemoveForRecordAsync(string accountId, string entity, string recordId, CancellationToken ct = default)
    {
        Validate(accountId, entity, recordId);
        await using var connection = _database.OpenConnection();
        await using var command = connection.CreateCommand();
        command.CommandText = "delete from sync_queue where account_id=$account and entity=$entity and record_id=$record;";
        command.Parameters.AddWithValue("$account", accountId);
        command.Parameters.AddWithValue("$entity", entity);
        command.Parameters.AddWithValue("$record", recordId);
        await command.ExecuteNonQueryAsync(ct);
    }

    private async Task DeleteByIdAsync(long id, CancellationToken ct)
    {
        await using var connection = _database.OpenConnection();
        await using var command = connection.CreateCommand();
        command.CommandText = "delete from sync_queue where id=$id;";
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
