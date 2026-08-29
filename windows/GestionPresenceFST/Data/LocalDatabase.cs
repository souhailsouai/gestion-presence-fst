using System.IO;
using Microsoft.Data.Sqlite;

namespace GestionPresenceFST.Data;

public sealed class LocalDatabase : IAsyncDisposable
{
    private readonly string _connectionString;

    public LocalDatabase(string databasePath)
    {
        if (string.IsNullOrWhiteSpace(databasePath))
            throw new ArgumentException("A database path is required.", nameof(databasePath));

        var directory = Path.GetDirectoryName(Path.GetFullPath(databasePath));
        if (!string.IsNullOrWhiteSpace(directory)) Directory.CreateDirectory(directory);

        _connectionString = new SqliteConnectionStringBuilder
        {
            DataSource = databasePath,
            Mode = SqliteOpenMode.ReadWriteCreate,
            Cache = SqliteCacheMode.Shared,
            Pooling = false
        }.ToString();
    }

    internal SqliteConnection OpenConnection()
    {
        var connection = new SqliteConnection(_connectionString);
        connection.Open();
        return connection;
    }

    public async Task InitializeAsync(CancellationToken ct = default)
    {
        await using var connection = OpenConnection();
        using var transaction = connection.BeginTransaction();
        await using var command = connection.CreateCommand();
        command.Transaction = transaction;
        command.CommandText = """
            create table if not exists local_records(
              account_id text not null,
              entity text not null check(entity in ('classes','students','sessions','attendance')),
              record_id text not null,
              json text not null,
              remote_updated_at text null,
              local_updated_at text not null,
              sync_state text not null default 'synced',
              primary key(account_id, entity, record_id)
            );
            create index if not exists ix_local_records_account_entity
              on local_records(account_id, entity);

            create table if not exists sync_queue(
              id integer primary key autoincrement,
              account_id text not null,
              entity text not null check(entity in ('classes','students','sessions','attendance')),
              record_id text not null,
              operation text not null check(operation in ('insert','update','delete')),
              payload_json text not null,
              base_updated_at text null,
              retry_count integer not null default 0,
              last_error text null,
              retryable integer not null default 1,
              created_at text not null
            );
            create index if not exists ix_sync_queue_account
              on sync_queue(account_id, id);

            create table if not exists sync_conflicts(
              id integer primary key autoincrement,
              account_id text not null,
              entity text not null check(entity in ('classes','students','sessions','attendance')),
              record_id text not null,
              local_json text not null,
              remote_json text null,
              base_updated_at text null,
              reason text not null,
              resolved integer not null default 0,
              created_at text not null
            );
            create index if not exists ix_sync_conflicts_account_open
              on sync_conflicts(account_id, resolved, id);
            """;
        await command.ExecuteNonQueryAsync(ct);
        await transaction.CommitAsync(ct);
    }

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;
}
