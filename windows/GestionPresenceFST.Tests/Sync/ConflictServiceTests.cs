using GestionPresenceFST.Data;
using GestionPresenceFST.Models;
using GestionPresenceFST.Sync;
using Xunit;

public sealed class ConflictServiceTests
{
    [Fact]
    public async Task ConflictStoresBothVersions()
    {
        var path = Path.Combine(Path.GetTempPath(), $"presence-{Guid.NewGuid():N}.db");
        try
        {
            await using var db = new LocalDatabase(path);
            await db.InitializeAsync();
            var conflicts = new ConflictService(db);
            await conflicts.AddConflictAsync(new SyncConflict(
                0,
                "u1",
                "attendance",
                "a1",
                "{\"id\":\"a1\",\"grade\":14}",
                "{\"id\":\"a1\",\"grade\":15}",
                "2026-08-29T10:00:00Z",
                "remote_changed"));

            var saved = Assert.Single(await conflicts.GetOpenAsync("u1"));
            Assert.Contains("14", saved.LocalJson);
            Assert.Contains("15", saved.RemoteJson);
            Assert.Equal("remote_changed", saved.Reason);
        }
        finally
        {
            if (File.Exists(path)) File.Delete(path);
        }
    }
}
