using GestionPresenceFST.Data;
using GestionPresenceFST.Models;
using GestionPresenceFST.Sync;
using Xunit;

public sealed class SyncQueueTests
{
    [Fact]
    public async Task PendingOperationSurvivesServiceRecreation()
    {
        var path = Path.Combine(Path.GetTempPath(), $"presence-{Guid.NewGuid():N}.db");
        try
        {
            await using var db = new LocalDatabase(path);
            await db.InitializeAsync();
            var first = new SyncQueueService(db);
            await first.EnqueueAsync("u1", "attendance", "a1", SyncOperation.Update, "{\"id\":\"a1\",\"grade\":14}", "2026-08-29T10:00:00Z");

            var second = new SyncQueueService(db);
            var pending = await second.GetPendingAsync("u1");

            var operation = Assert.Single(pending);
            Assert.Equal("attendance", operation.Entity);
            Assert.Equal("a1", operation.RecordId);
            Assert.Equal(SyncOperation.Update, operation.Operation);
            Assert.Equal("2026-08-29T10:00:00Z", operation.BaseUpdatedAt);
        }
        finally
        {
            if (File.Exists(path)) File.Delete(path);
        }
    }
}
