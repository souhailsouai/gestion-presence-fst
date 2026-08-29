using System.Text.Json;
using GestionPresenceFST.Models;

namespace GestionPresenceFST.Sync;

public interface IRemoteSyncClient
{
    Task<JsonDocument> GetFullSnapshotAsync(string entity, CancellationToken ct = default);
    Task<RemoteWriteResult> InsertAsync(string entity, string payloadJson, CancellationToken ct = default);
    Task<RemoteWriteResult> UpdateIfUnchangedAsync(string entity, string id, string payloadJson, string baseUpdatedAt, CancellationToken ct = default);
    Task<RemoteWriteResult> DeleteIfUnchangedAsync(string entity, string id, string baseUpdatedAt, CancellationToken ct = default);
}
