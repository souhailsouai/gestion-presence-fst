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
            Cache = SqliteCacheMode.Shared
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
            """;
        await command.ExecuteNonQueryAsync(ct);
        await transaction.CommitAsync(ct);
    }

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;
}
