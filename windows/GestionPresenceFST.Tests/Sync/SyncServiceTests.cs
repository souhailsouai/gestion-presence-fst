using System.Text.Json;
using GestionPresenceFST.Data;
using GestionPresenceFST.Models;
using GestionPresenceFST.Sync;
using Xunit;

public sealed class SyncServiceTests
{
    [Fact]
    public async Task QueuedUpdatePushesWhenRemoteTimestampMatches()
    {
        await using var fixture = await SyncFixture.CreateAsync();
        using var original = JsonDocument.Parse("""{"id":"a1","grade":12,"updated_at":"2026-08-29T10:00:00Z"}""");
        await fixture.Local.UpsertSnapshotAsync("u1", "attendance", original.RootElement);
        await fixture.Queue.EnqueueAsync("u1", "attendance", "a1", SyncOperation.Update,
            "{\"id\":\"a1\",\"grade\":14}", "2026-08-29T10:00:00Z");
        fixture.Remote.UpdateResult = new RemoteWriteResult(true,
            "[{\"id\":\"a1\",\"grade\":14,\"updated_at\":\"2026-08-29T11:00:00Z\"}]", false, 200, null);
        fixture.Remote.SetSnapshot("attendance", "[{\"id\":\"a1\",\"grade\":14,\"updated_at\":\"2026-08-29T11:00:00Z\"}]");

        var summary = await fixture.Service.SynchronizeAsync("u1");

        Assert.Equal(1, summary.Pushed);
        Assert.Empty(await fixture.Queue.GetPendingAsync("u1"));
        var row = Assert.Single(await fixture.Local.GetSnapshotAsync("u1", "attendance"));
        Assert.Equal(14, row.RootElement.GetProperty("grade").GetInt32());
        row.Dispose();
    }

    [Fact]
    public async Task ChangedRemoteTimestampCreatesConflictAndDoesNotRetryAutomatically()
    {
        await using var fixture = await SyncFixture.CreateAsync();
        await fixture.Queue.EnqueueAsync("u1", "attendance", "a1", SyncOperation.Update,
            "{\"id\":\"a1\",\"grade\":14}", "2026-08-29T10:00:00Z");
        fixture.Remote.UpdateResult = new RemoteWriteResult(false,
            "{\"id\":\"a1\",\"grade\":15,\"updated_at\":\"2026-08-29T10:30:00Z\"}", true, 200, "remote_changed");
        fixture.Remote.SetSnapshot("attendance", "[{\"id\":\"a1\",\"grade\":15,\"updated_at\":\"2026-08-29T10:30:00Z\"}]");

        var summary = await fixture.Service.SynchronizeAsync("u1");

        Assert.Equal(1, summary.Conflicts);
        Assert.Empty(await fixture.Queue.GetPendingAsync("u1"));
        var conflict = Assert.Single(await fixture.Conflicts.GetOpenAsync("u1"));
        Assert.Contains("14", conflict.LocalJson);
        Assert.Contains("15", conflict.RemoteJson);
    }

    [Fact]
    public async Task RemoteMissingCleanRowRemovesLocalSnapshot()
    {
        await using var fixture = await SyncFixture.CreateAsync();
        using var original = JsonDocument.Parse("""{"id":"s1","first_name":"A","updated_at":"2026-08-29T10:00:00Z"}""");
        await fixture.Local.UpsertSnapshotAsync("u1", "students", original.RootElement);
        fixture.Remote.SetSnapshot("students", "[]");

        await fixture.Service.SynchronizeAsync("u1");

        Assert.Empty(await fixture.Local.GetSnapshotAsync("u1", "students"));
    }

    private sealed class SyncFixture : IAsyncDisposable
    {
        private readonly string _path;
        public LocalDatabase Db { get; }
        public LocalDataService Local { get; }
        public SyncQueueService Queue { get; }
        public ConflictService Conflicts { get; }
        public FakeRemoteSyncClient Remote { get; }
        public SyncService Service { get; }

        private SyncFixture(string path, LocalDatabase db)
        {
            _path = path;
            Db = db;
            Local = new LocalDataService(db);
            Queue = new SyncQueueService(db);
            Conflicts = new ConflictService(db);
            Remote = new FakeRemoteSyncClient();
            Service = new SyncService(Local, Queue, Conflicts, Remote);
        }

        public static async Task<SyncFixture> CreateAsync()
        {
            var path = Path.Combine(Path.GetTempPath(), $"presence-{Guid.NewGuid():N}.db");
            var db = new LocalDatabase(path);
            await db.InitializeAsync();
            return new SyncFixture(path, db);
        }

        public async ValueTask DisposeAsync()
        {
            await Db.DisposeAsync();
            if (File.Exists(_path)) File.Delete(_path);
        }
    }

    private sealed class FakeRemoteSyncClient : IRemoteSyncClient
    {
        private readonly Dictionary<string, string> _snapshots = SyncEntities.All.ToDictionary(e => e, _ => "[]");
        public RemoteWriteResult UpdateResult { get; set; } = new(true, "[]", false, 200, null);

        public void SetSnapshot(string entity, string json) => _snapshots[entity] = json;
        public Task<JsonDocument> GetFullSnapshotAsync(string entity, CancellationToken ct = default)
            => Task.FromResult(JsonDocument.Parse(_snapshots[entity]));
        public Task<RemoteWriteResult> InsertAsync(string entity, string payloadJson, CancellationToken ct = default)
            => Task.FromResult(new RemoteWriteResult(true, $"[{payloadJson}]", false, 201, null));
        public Task<RemoteWriteResult> UpdateIfUnchangedAsync(string entity, string id, string payloadJson, string baseUpdatedAt, CancellationToken ct = default)
            => Task.FromResult(UpdateResult);
        public Task<RemoteWriteResult> DeleteIfUnchangedAsync(string entity, string id, string baseUpdatedAt, CancellationToken ct = default)
            => Task.FromResult(new RemoteWriteResult(true, "[]", false, 200, null));
    }
}
