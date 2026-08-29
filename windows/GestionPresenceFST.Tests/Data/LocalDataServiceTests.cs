using System.Text.Json;
using GestionPresenceFST.Data;
using Xunit;

public sealed class LocalDataServiceTests
{
    [Fact]
    public async Task SnapshotRowsAreIsolatedByAccount()
    {
        var path = Path.Combine(Path.GetTempPath(), $"presence-{Guid.NewGuid():N}.db");
        try
        {
            await using var db = new LocalDatabase(path);
            await db.InitializeAsync();
            var service = new LocalDataService(db);

            using var document = JsonDocument.Parse("""{"id":"r1","updated_at":"2026-08-29T10:00:00Z","first_name":"A"}""");
            await service.UpsertSnapshotAsync("user-a", "students", document.RootElement);

            var accountA = await service.GetSnapshotAsync("user-a", "students");
            var accountB = await service.GetSnapshotAsync("user-b", "students");

            Assert.Single(accountA);
            Assert.Empty(accountB);
            Assert.Equal("r1", accountA[0].RootElement.GetProperty("id").GetString());

            foreach (var item in accountA) item.Dispose();
            foreach (var item in accountB) item.Dispose();
        }
        finally
        {
            if (File.Exists(path)) File.Delete(path);
        }
    }
}
