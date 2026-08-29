# Windows Offline Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing .NET 8 WPF/WebView2 Windows client so it uses the same HTML/Supabase application online, keeps pedagogical data in account-scoped SQLite offline, synchronizes safely when connectivity returns, exposes explicit conflict resolution, and applies the same session-date colors in HTML and Windows.

**Architecture:** Keep the existing `windows/GestionPresenceFST` WPF shell and WebView2. Add focused native services for SQLite, durable sync queue, Supabase REST access under the current user JWT, connectivity, and conflict detection. The HTML uses a JavaScript/C# WebView bridge only when running inside Windows; normal browser HTML continues to talk directly to Supabase.

**Tech Stack:** .NET 8 WPF, Microsoft.Web.WebView2 `1.0.3537.50`, Microsoft.Data.Sqlite `8.0.19`, `HttpClient`, System.Text.Json, xUnit `2.9.2`, Microsoft.NET.Test.Sdk `17.12.0`, GitHub Actions `windows-latest`, existing Supabase project and RLS.

**Spec:** `docs/superpowers/specs/2026-08-29-windows-offline-sync-design.md`

## Global Constraints

- Keep WPF + WebView2; do not replace it with Tauri or Electron.
- Supabase remains the only remote source of truth.
- Never embed a Supabase service-role/secret key in HTML or Windows.
- Native Supabase requests use the public/publishable key plus the authenticated user's access token so existing RLS remains authoritative.
- Offline-capable entities are only `classes`, `students`, `sessions`, and `attendance`.
- Account/PIN/password/Admin/Super Admin changes remain online-only.
- Preserve existing teacher directory, persistent session, Admin, and Super Admin behavior.
- Conflict detection uses existing server-maintained `updated_at` columns; verified triggers already update `updated_at` on UPDATE for all four synchronized tables.
- Remote deletes are detected by full table snapshots, not by adding `deleted_at` columns.
- Date colors are exactly: gray available, orange selected-unconfirmed, blue confirmed-open, green completed, red sync error/conflict.
- Use TDD for every production behavior change.

---

## File Structure

Create or modify these units only:

- `web/index.html` — approved shared HTML application, browser behavior unchanged, Windows bridge adapter and date/sync states added.
- `windows/GestionPresenceFST/GestionPresenceFST.csproj` — SQLite package, copy `web/index.html`, deterministic build settings.
- `windows/GestionPresenceFST/MainWindow.xaml.cs` — composition root and WebView bridge wiring only.
- `windows/GestionPresenceFST/Models/SyncModels.cs` — sync enums/records and bridge DTOs.
- `windows/GestionPresenceFST/Data/LocalDatabase.cs` — SQLite connection, schema creation, transactions.
- `windows/GestionPresenceFST/Data/LocalDataService.cs` — account-scoped CRUD/snapshot cache.
- `windows/GestionPresenceFST/Sync/SyncQueueService.cs` — durable pending operation queue.
- `windows/GestionPresenceFST/Sync/ConflictService.cs` — conflict persistence and resolution state.
- `windows/GestionPresenceFST/Sync/SupabaseRestClient.cs` — authenticated PostgREST calls, no service key.
- `windows/GestionPresenceFST/Sync/SyncService.cs` — push queue, pull full snapshots, reconciliation.
- `windows/GestionPresenceFST/Sync/ConnectivityService.cs` — online/offline state and change event.
- `windows/GestionPresenceFST/Web/WebViewBridge.cs` — typed message contract between HTML and C#.
- `windows/GestionPresenceFST.Tests/...` — unit/integration tests.
- `.github/workflows/build-windows.yml` — restore, test, publish and artifact upload.

---

### Task 1: Establish the Windows test harness and approved shared HTML baseline

**Files:**
- Create: `windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj`
- Create: `windows/GestionPresenceFST.Tests/Smoke/BaselineTests.cs`
- Create: `web/index.html`
- Modify: `windows/GestionPresenceFST/GestionPresenceFST.csproj`

**Interfaces:**
- Consumes: current WPF project and the latest approved HTML application snapshot.
- Produces: test project and one canonical `web/index.html` copied into Windows output.

- [ ] **Step 1: Write the failing baseline test**

```csharp
using Xunit;

public sealed class BaselineTests
{
    [Fact]
    public void SharedHtmlExistsAndContainsSupabaseAppMarkers()
    {
        var root = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "../../../../../"));
        var html = File.ReadAllText(Path.Combine(root, "web", "index.html"));
        Assert.Contains("supabase", html, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("loginTeacher", html);
        Assert.Contains("teacher_directory", html);
        Assert.Contains("admin-teacher", html);
    }
}
```

- [ ] **Step 2: Run test and verify RED**

Run:
```bash
dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj --filter BaselineTests
```
Expected: FAIL because `web/index.html` or test project does not yet exist.

- [ ] **Step 3: Add pinned test/SQLite packages and canonical HTML copy rule**

`GestionPresenceFST.Tests.csproj`:
```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0-windows</TargetFramework>
    <IsPackable>false</IsPackable>
    <Nullable>enable</Nullable>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.12.0" />
    <PackageReference Include="xunit" Version="2.9.2" />
    <PackageReference Include="xunit.runner.visualstudio" Version="2.8.2" PrivateAssets="all" />
  </ItemGroup>
  <ItemGroup>
    <ProjectReference Include="..\GestionPresenceFST\GestionPresenceFST.csproj" />
  </ItemGroup>
</Project>
```

In the app project add:
```xml
<PackageReference Include="Microsoft.Data.Sqlite" Version="8.0.19" />
<Content Include="..\..\..\web\index.html" Link="web\index.html" CopyToOutputDirectory="PreserveNewest" />
```
Remove the obsolete `..\..\web\index.html` include.

Create `web/index.html` from the latest approved old-style HTML/Super Admin application snapshot; do not introduce a visual redesign.

- [ ] **Step 4: Run baseline test and verify GREEN**

Run:
```bash
dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj --filter BaselineTests
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/index.html windows/GestionPresenceFST windows/GestionPresenceFST.Tests
git commit -m "test: establish Windows sync baseline"
```

---

### Task 2: Add account-scoped SQLite schema and local repository

**Files:**
- Create: `windows/GestionPresenceFST/Data/LocalDatabase.cs`
- Create: `windows/GestionPresenceFST/Data/LocalDataService.cs`
- Create: `windows/GestionPresenceFST/Models/SyncModels.cs`
- Create: `windows/GestionPresenceFST.Tests/Data/LocalDataServiceTests.cs`

**Interfaces:**
- Produces:
  - `Task InitializeAsync(CancellationToken ct = default)`
  - `Task UpsertSnapshotAsync(string accountId, string entity, JsonElement record, CancellationToken ct = default)`
  - `Task<IReadOnlyList<JsonDocument>> GetSnapshotAsync(string accountId, string entity, CancellationToken ct = default)`
  - `Task RemoveSnapshotAsync(string accountId, string entity, string recordId, CancellationToken ct = default)`

- [ ] **Step 1: Write a failing account-isolation test**

```csharp
[Fact]
public async Task SnapshotRowsAreIsolatedByAccount()
{
    await using var db = TestDatabase.Create();
    var service = new LocalDataService(db);
    await db.InitializeAsync();

    using var a = JsonDocument.Parse("""{"id":"r1","updated_at":"2026-08-29T10:00:00Z"}""");
    await service.UpsertSnapshotAsync("user-a", "students", a.RootElement);

    Assert.Single(await service.GetSnapshotAsync("user-a", "students"));
    Assert.Empty(await service.GetSnapshotAsync("user-b", "students"));
}
```

- [ ] **Step 2: Run and verify RED**

```bash
dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj --filter LocalDataServiceTests
```
Expected: FAIL because `LocalDatabase`/`LocalDataService` do not exist.

- [ ] **Step 3: Implement the minimal local schema**

`LocalDatabase.InitializeAsync()` executes one transaction creating:

```sql
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
```

`UpsertSnapshotAsync` extracts `id` and optional `updated_at`; store JSON unchanged so the cache mirrors remote records without duplicating schema mapping logic.

- [ ] **Step 4: Run tests and verify GREEN**

```bash
dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj --filter LocalDataServiceTests
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add windows/GestionPresenceFST/Data windows/GestionPresenceFST/Models windows/GestionPresenceFST.Tests/Data
git commit -m "feat: add account-scoped SQLite cache"
```

---

### Task 3: Add durable sync queue and conflict persistence

**Files:**
- Create: `windows/GestionPresenceFST/Sync/SyncQueueService.cs`
- Create: `windows/GestionPresenceFST/Sync/ConflictService.cs`
- Modify: `windows/GestionPresenceFST/Data/LocalDatabase.cs`
- Modify: `windows/GestionPresenceFST/Models/SyncModels.cs`
- Create: `windows/GestionPresenceFST.Tests/Sync/SyncQueueTests.cs`
- Create: `windows/GestionPresenceFST.Tests/Sync/ConflictServiceTests.cs`

**Interfaces:**
- `enum SyncOperation { Insert, Update, Delete }`
- `record PendingOperation(long Id, string AccountId, string Entity, string RecordId, SyncOperation Operation, string PayloadJson, string? BaseUpdatedAt, int RetryCount)`
- `record SyncConflict(long Id, string AccountId, string Entity, string RecordId, string LocalJson, string? RemoteJson, string? BaseUpdatedAt, string Reason)`
- `Task<long> EnqueueAsync(...)`
- `Task<IReadOnlyList<PendingOperation>> GetPendingAsync(string accountId, CancellationToken ct = default)`
- `Task MarkSucceededAsync(long operationId, CancellationToken ct = default)`
- `Task MarkFailedAsync(long operationId, string error, bool retryable, CancellationToken ct = default)`
- `Task<long> AddConflictAsync(SyncConflict conflict, CancellationToken ct = default)`

- [ ] **Step 1: Write failing durability/conflict tests**

```csharp
[Fact]
public async Task PendingOperationSurvivesServiceRecreation()
{
    await using var db = TestDatabase.Create();
    await db.InitializeAsync();
    var q1 = new SyncQueueService(db);
    await q1.EnqueueAsync("u1", "attendance", "a1", SyncOperation.Update, "{}", "2026-08-29T10:00:00Z");

    var q2 = new SyncQueueService(db);
    Assert.Single(await q2.GetPendingAsync("u1"));
}

[Fact]
public async Task ConflictStoresBothVersions()
{
    await using var db = TestDatabase.Create();
    await db.InitializeAsync();
    var conflicts = new ConflictService(db);
    await conflicts.AddConflictAsync(new(0,"u1","attendance","a1","{\"grade\":14}","{\"grade\":15}","2026-08-29T10:00:00Z","remote_changed"));
    var saved = Assert.Single(await conflicts.GetOpenAsync("u1"));
    Assert.Contains("14", saved.LocalJson);
    Assert.Contains("15", saved.RemoteJson);
}
```

- [ ] **Step 2: Run and verify RED**

```bash
dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj --filter "SyncQueueTests|ConflictServiceTests"
```
Expected: FAIL.

- [ ] **Step 3: Implement queue/conflict tables and services**

Add to initialization:
```sql
create table if not exists sync_queue(
  id integer primary key autoincrement,
  account_id text not null,
  entity text not null,
  record_id text not null,
  operation text not null,
  payload_json text not null,
  base_updated_at text null,
  retry_count integer not null default 0,
  last_error text null,
  retryable integer not null default 1,
  created_at text not null
);
create table if not exists sync_conflicts(
  id integer primary key autoincrement,
  account_id text not null,
  entity text not null,
  record_id text not null,
  local_json text not null,
  remote_json text null,
  base_updated_at text null,
  reason text not null,
  resolved integer not null default 0,
  created_at text not null
);
```

- [ ] **Step 4: Run tests and verify GREEN**

```bash
dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj --filter "SyncQueueTests|ConflictServiceTests"
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add windows/GestionPresenceFST windows/GestionPresenceFST.Tests
git commit -m "feat: add durable sync queue and conflicts"
```

---

### Task 4: Add authenticated Supabase REST client with conditional updates

**Files:**
- Create: `windows/GestionPresenceFST/Sync/SupabaseRestClient.cs`
- Create: `windows/GestionPresenceFST.Tests/Sync/SupabaseRestClientTests.cs`

**Interfaces:**
- `void SetSession(string userId, string accessToken)`
- `Task<JsonDocument> GetFullSnapshotAsync(string entity, CancellationToken ct = default)`
- `Task<RemoteWriteResult> InsertAsync(string entity, string payloadJson, CancellationToken ct = default)`
- `Task<RemoteWriteResult> UpdateIfUnchangedAsync(string entity, string id, string payloadJson, string baseUpdatedAt, CancellationToken ct = default)`
- `Task<RemoteWriteResult> DeleteIfUnchangedAsync(string entity, string id, string baseUpdatedAt, CancellationToken ct = default)`
- `record RemoteWriteResult(bool Applied, string? ReturnedJson, bool Conflict, int StatusCode, string? Error)`

- [ ] **Step 1: Write failing request-shape tests using a fake HttpMessageHandler**

```csharp
[Fact]
public async Task ConditionalUpdateFiltersByIdAndUpdatedAtAndUsesUserJwt()
{
    var handler = new RecordingHandler(HttpStatusCode.OK, "[{\"id\":\"a1\",\"updated_at\":\"2026-08-29T11:00:00Z\"}]");
    var client = new SupabaseRestClient(new HttpClient(handler), "https://example.supabase.co", "publishable-key");
    client.SetSession("u1", "jwt-token");

    await client.UpdateIfUnchangedAsync("attendance", "a1", "{\"grade\":14}", "2026-08-29T10:00:00Z");

    Assert.Contains("id=eq.a1", handler.LastRequest!.RequestUri!.Query);
    Assert.Contains("updated_at=eq.2026-08-29T10%3A00%3A00Z", handler.LastRequest.RequestUri.Query);
    Assert.Equal("Bearer", handler.LastRequest.Headers.Authorization!.Scheme);
    Assert.Equal("jwt-token", handler.LastRequest.Headers.Authorization.Parameter);
}
```

- [ ] **Step 2: Run and verify RED**

```bash
dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj --filter SupabaseRestClientTests
```
Expected: FAIL.

- [ ] **Step 3: Implement minimal PostgREST client**

Use `/rest/v1/{entity}`. For every request add:
```csharp
request.Headers.Add("apikey", _publishableKey);
request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _accessToken);
request.Headers.Add("Prefer", "return=representation");
```

Update URI must include both filters:
```text
/rest/v1/attendance?id=eq.a1&updated_at=eq.<baseTimestamp>
```
If PATCH/DELETE returns success with an empty JSON array, immediately fetch `id=eq.<id>`; classify as conflict if a row still exists for update, or as remote-delete conflict if it disappeared while local operation was UPDATE.

- [ ] **Step 4: Run tests and verify GREEN**

```bash
dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj --filter SupabaseRestClientTests
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add windows/GestionPresenceFST/Sync/SupabaseRestClient.cs windows/GestionPresenceFST.Tests/Sync/SupabaseRestClientTests.cs
git commit -m "feat: add RLS-safe Supabase sync client"
```

---

### Task 5: Implement push/pull synchronization and conflict reconciliation

**Files:**
- Create: `windows/GestionPresenceFST/Sync/SyncService.cs`
- Create: `windows/GestionPresenceFST.Tests/Sync/SyncServiceTests.cs`

**Interfaces:**
- `Task<SyncSummary> SynchronizeAsync(string accountId, CancellationToken ct = default)`
- `Task ResolveConflictAsync(long conflictId, ConflictChoice choice, CancellationToken ct = default)`
- `enum ConflictChoice { KeepWindows, KeepSupabase }`
- `record SyncSummary(int Pushed, int Pulled, int Pending, int Conflicts)`

- [ ] **Step 1: Write failing core synchronization tests**

Tests must cover:
```csharp
[Fact] public async Task OfflineQueuedUpdatePushesWhenRemoteTimestampMatches() { /* queue one update; remote base matches; assert queue cleared and cache refreshed */ }
[Fact] public async Task ChangedRemoteTimestampCreatesConflictAndDoesNotOverwriteRemote() { /* remote newer; assert conflict + pending removed from automatic retries */ }
[Fact] public async Task RemoteMissingCleanRowRemovesLocalSnapshot() { /* full pull omits row and no local pending op; assert local removed */ }
[Fact] public async Task RemoteMissingLocallyModifiedRowCreatesDeleteConflict() { /* pending local update; remote row missing; assert conflict */ }
```

- [ ] **Step 2: Run and verify RED**

```bash
dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj --filter SyncServiceTests
```
Expected: FAIL.

- [ ] **Step 3: Implement push first, then full snapshot pull**

Pseudocode must be implemented exactly in this order:
```csharp
foreach (var op in await _queue.GetPendingAsync(accountId, ct))
{
    var result = await PushOneAsync(op, ct);
    if (result.Conflict) await PersistConflictAndStopRetryAsync(op, result, ct);
    else if (result.Applied) await MarkAppliedAndRefreshLocalAsync(op, result, ct);
    else await _queue.MarkFailedAsync(op.Id, result.Error ?? "sync_error", IsRetryable(result.StatusCode), ct);
}

foreach (var entity in SyncEntities.All)
{
    var remoteRows = await _remote.GetFullSnapshotAsync(entity, ct);
    await ReconcileFullSnapshotAsync(accountId, entity, remoteRows, ct);
}
```

Full snapshot reconciliation uses UUID set comparison to detect remote deletions. Never delete a local row that has a pending operation; create a conflict instead.

- [ ] **Step 4: Implement explicit conflict resolution**

`KeepWindows`: fetch current remote record, use its `updated_at` as the new base, perform one conditional write, then refresh local cache.

`KeepSupabase`: overwrite local cache with remote JSON, discard matching queued operation, mark conflict resolved.

- [ ] **Step 5: Run tests and verify GREEN**

```bash
dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj --filter SyncServiceTests
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add windows/GestionPresenceFST/Sync/SyncService.cs windows/GestionPresenceFST.Tests/Sync/SyncServiceTests.cs
git commit -m "feat: synchronize cached data with conflict detection"
```

---

### Task 6: Add connectivity and startup orchestration

**Files:**
- Create: `windows/GestionPresenceFST/Sync/ConnectivityService.cs`
- Modify: `windows/GestionPresenceFST/MainWindow.xaml.cs`
- Create: `windows/GestionPresenceFST.Tests/Sync/ConnectivityServiceTests.cs`

**Interfaces:**
- `bool IsOnline { get; }`
- `event EventHandler<bool>? ConnectivityChanged`
- `Task StartAsync(CancellationToken ct = default)`

- [ ] **Step 1: Write failing state-transition test**

```csharp
[Fact]
public async Task ReturningOnlineRaisesEventOnce()
{
    var probe = new FakeConnectivityProbe(false, true, true);
    var service = new ConnectivityService(probe, TimeSpan.FromMilliseconds(1));
    var states = new List<bool>();
    service.ConnectivityChanged += (_, online) => states.Add(online);
    await service.PollOnceAsync();
    await service.PollOnceAsync();
    await service.PollOnceAsync();
    Assert.Equal(new[] { true }, states);
}
```

- [ ] **Step 2: Run RED**

```bash
dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj --filter ConnectivityServiceTests
```

- [ ] **Step 3: Implement connectivity using a lightweight HTTPS probe to the configured Supabase host**

Do not use `NetworkInterface.GetIsNetworkAvailable()` as the sole criterion. Treat a successful HTTP response (including authenticated 4xx) from the Supabase host as reachable; timeout/DNS/connection failure means offline.

`MainWindow` remains a composition root: create database/services, initialize SQLite before WebView navigation, and trigger sync only after the bridge supplies an authenticated session.

- [ ] **Step 4: Run GREEN**

```bash
dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj --filter ConnectivityServiceTests
```

- [ ] **Step 5: Commit**

```bash
git add windows/GestionPresenceFST/Sync/ConnectivityService.cs windows/GestionPresenceFST/MainWindow.xaml.cs windows/GestionPresenceFST.Tests/Sync/ConnectivityServiceTests.cs
git commit -m "feat: orchestrate sync on connectivity changes"
```

---

### Task 7: Implement typed WebView JavaScript/C# bridge

**Files:**
- Create: `windows/GestionPresenceFST/Web/WebViewBridge.cs`
- Modify: `windows/GestionPresenceFST/MainWindow.xaml.cs`
- Create: `windows/GestionPresenceFST.Tests/Web/WebViewBridgeTests.cs`

**Interfaces:**

JavaScript -> C# messages:
```json
{"type":"auth.session","requestId":"1","payload":{"userId":"...","accessToken":"...","expiresAt":1788020000}}
{"type":"data.query","requestId":"2","payload":{"entity":"attendance"}}
{"type":"data.mutate","requestId":"3","payload":{"entity":"attendance","operation":"update","record":{"id":"..."},"baseUpdatedAt":"2026-08-29T10:00:00Z"}}
{"type":"sync.now","requestId":"4","payload":{}}
{"type":"conflict.resolve","requestId":"5","payload":{"conflictId":12,"choice":"keepWindows"}}
```

C# -> JavaScript:
```json
{"type":"bridge.response","requestId":"3","ok":true,"data":{}}
{"type":"sync.status","payload":{"state":"pending","pendingCount":2,"conflictCount":0,"lastSyncAt":null}}
{"type":"conflicts.changed","payload":{"count":1}}
```

- [ ] **Step 1: Write failing parsing/routing tests**

```csharp
[Fact]
public async Task MutateMessageQueuesUpdateWithBaseTimestamp()
{
    var fixture = new BridgeFixture();
    await fixture.Bridge.HandleJsonAsync("""{"type":"data.mutate","requestId":"3","payload":{"entity":"attendance","operation":"update","record":{"id":"a1","grade":14},"baseUpdatedAt":"2026-08-29T10:00:00Z"}}""");
    var op = Assert.Single(await fixture.Queue.GetPendingAsync(fixture.AccountId));
    Assert.Equal("a1", op.RecordId);
    Assert.Equal("2026-08-29T10:00:00Z", op.BaseUpdatedAt);
}
```

- [ ] **Step 2: Run RED**

```bash
dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj --filter WebViewBridgeTests
```

- [ ] **Step 3: Implement bridge routing and response correlation**

Use `CoreWebView2.WebMessageReceived` and `CoreWebView2.PostWebMessageAsJson`. Reject unknown entities/actions with structured error responses; never execute arbitrary method names supplied by JavaScript.

- [ ] **Step 4: Run GREEN**

```bash
dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj --filter WebViewBridgeTests
```

- [ ] **Step 5: Commit**

```bash
git add windows/GestionPresenceFST/Web windows/GestionPresenceFST/MainWindow.xaml.cs windows/GestionPresenceFST.Tests/Web
git commit -m "feat: add typed Windows WebView bridge"
```

---

### Task 8: Add HTML native adapter without changing normal browser behavior

**Files:**
- Modify: `web/index.html`
- Create: `windows/GestionPresenceFST.Tests/Html/NativeAdapterContractTests.cs`

**Interfaces:**
- `window.FSTNative.isWindows` — true only when `window.chrome?.webview` exists.
- `window.FSTNative.request(type, payload)` — Promise correlated by `requestId`.
- `window.FSTNative.setSession(session)` — sends current authenticated user/JWT to C#.
- `window.FSTNative.query(entity)`
- `window.FSTNative.mutate(entity, operation, record, baseUpdatedAt)`
- `window.FSTNative.syncNow()`

- [ ] **Step 1: Write failing static contract test**

```csharp
[Fact]
public void HtmlContainsNativeBridgeWithoutReplacingBrowserSupabaseClient()
{
    var html = TestPaths.ReadWebHtml();
    Assert.Contains("window.FSTNative", html);
    Assert.Contains("window.chrome?.webview", html);
    Assert.Contains("auth.session", html);
    Assert.Contains("supabaseClient", html);
}
```

- [ ] **Step 2: Run RED**

```bash
dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj --filter NativeAdapterContractTests
```

- [ ] **Step 3: Add minimal adapter**

Core behavior:
```javascript
window.FSTNative = (() => {
  const pending = new Map();
  const isWindows = !!window.chrome?.webview;
  let seq = 0;
  if (isWindows) window.chrome.webview.addEventListener('message', ev => {
    const m = ev.data;
    if (m?.type === 'bridge.response' && pending.has(m.requestId)) {
      const p = pending.get(m.requestId); pending.delete(m.requestId);
      m.ok ? p.resolve(m.data) : p.reject(new Error(m.error || 'Windows bridge error'));
    }
    window.dispatchEvent(new CustomEvent('fst-native-event', {detail:m}));
  });
  function request(type, payload={}) {
    if (!isWindows) return Promise.reject(new Error('Native bridge unavailable'));
    const requestId = String(++seq);
    return new Promise((resolve,reject) => {
      pending.set(requestId,{resolve,reject});
      window.chrome.webview.postMessage({type,requestId,payload});
    });
  }
  return {isWindows,request};
})();
```

After successful Supabase login/session restoration in Windows only, send `{userId, accessToken, expiresAt}`; never send password/PIN to C#.

- [ ] **Step 4: Route only synchronized pedagogical CRUD through the adapter when `FSTNative.isWindows`; keep current Supabase path for browser**

Create one dispatch helper:
```javascript
async function dataWrite(entity, operation, record, baseUpdatedAt=null) {
  if (window.FSTNative?.isWindows && ['classes','students','sessions','attendance'].includes(entity)) {
    return window.FSTNative.request('data.mutate',{entity,operation,record,baseUpdatedAt});
  }
  return existingSupabaseWrite(entity, operation, record, baseUpdatedAt);
}
```
Do not route account/Admin/Super Admin actions through offline storage.

- [ ] **Step 5: Run GREEN plus JavaScript syntax check**

```bash
dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj --filter NativeAdapterContractTests
node --check scripts/extracted-web-inline.js
```
Expected: PASS. If the HTML uses multiple inline scripts, extract/check each script separately in the test helper.

- [ ] **Step 6: Commit**

```bash
git add web/index.html windows/GestionPresenceFST.Tests/Html
git commit -m "feat: route Windows pedagogical data through native cache"
```

---

### Task 9: Implement shared date colors and compact synchronization UI

**Files:**
- Modify: `web/index.html`
- Create: `windows/GestionPresenceFST.Tests/Html/SessionDateStateTests.cs`

**Interfaces:**
- `getSessionDateState({selected, confirmed, completed, hasConflict, hasSyncError}) -> 'gray'|'orange'|'blue'|'green'|'red'`
- `.date-state-gray`, `.date-state-orange`, `.date-state-blue`, `.date-state-green`, `.date-state-red`
- sync status states: `synced`, `pending`, `syncing`, `error`, `offline`

- [ ] **Step 1: Write failing state-priority tests**

Static/JS contract assertions must prove:
```text
red overrides every other state
orange applies only selected + not confirmed
blue applies confirmed + not completed
 green applies completed
 gray is the default
```

Use a small Node test that imports/evaluates the pure state function extracted from HTML.

- [ ] **Step 2: Run RED**

```bash
node windows/GestionPresenceFST.Tests/Html/session-date-state.test.mjs
```
Expected: FAIL because function/classes do not exist.

- [ ] **Step 3: Add pure state function and CSS**

```javascript
function getSessionDateState(s){
  if (s.hasConflict || s.hasSyncError) return 'red';
  if (s.completed) return 'green';
  if (s.confirmed) return 'blue';
  if (s.selected) return 'orange';
  return 'gray';
}
```

Apply this consistently to date selector feedback, session list, attendance view, and dashboard session summaries. Add only a compact dot for sync state; title/ARIA text carries the descriptive state.

- [ ] **Step 4: Wire native sync events**

Listen to `fst-native-event`:
```javascript
window.addEventListener('fst-native-event', e => {
  if (e.detail?.type === 'sync.status') updateSyncIndicator(e.detail.payload);
  if (e.detail?.type === 'conflicts.changed') refreshConflictBadge(e.detail.payload.count);
});
```
Browser mode continues to derive sync state from existing Supabase operations.

- [ ] **Step 5: Run GREEN**

```bash
node windows/GestionPresenceFST.Tests/Html/session-date-state.test.mjs
dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj
```
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add web/index.html windows/GestionPresenceFST.Tests/Html
git commit -m "feat: share session date and sync states"
```

---

### Task 10: Enforce online-only sensitive administration in Windows

**Files:**
- Modify: `web/index.html`
- Modify: `windows/GestionPresenceFST/Web/WebViewBridge.cs`
- Create: `windows/GestionPresenceFST.Tests/Security/OfflineAdminGuardTests.cs`

**Interfaces:**
- Offline native bridge allows only `classes`, `students`, `sessions`, `attendance` data operations.
- `admin-teacher`, password/PIN, promote/demote Admin and Super Admin operations must remain direct authenticated online Supabase/Edge Function calls.

- [ ] **Step 1: Write failing allowlist tests**

```csharp
[Theory]
[InlineData("profiles")]
[InlineData("admin-teacher")]
[InlineData("admin-role")]
public async Task NativeMutationRejectsSensitiveEntities(string entity)
{
    var fixture = new BridgeFixture(isOnline:false);
    var response = await fixture.Bridge.HandleJsonAsync($$"""{"type":"data.mutate","requestId":"1","payload":{"entity":"{{entity}}","operation":"update","record":{"id":"x"}}}""");
    Assert.False(response.Ok);
    Assert.Equal("online_only", response.ErrorCode);
}
```

- [ ] **Step 2: Run RED**

```bash
dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj --filter OfflineAdminGuardTests
```

- [ ] **Step 3: Implement strict synchronized-entity allowlist in both C# bridge and JS dispatch helper**

```csharp
private static readonly HashSet<string> OfflineEntities = new(StringComparer.Ordinal)
{
    "classes", "students", "sessions", "attendance"
};
```
Reject everything else before touching SQLite.

- [ ] **Step 4: Run GREEN**

```bash
dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj --filter OfflineAdminGuardTests
```

- [ ] **Step 5: Commit**

```bash
git add web/index.html windows/GestionPresenceFST/Web windows/GestionPresenceFST.Tests/Security
git commit -m "security: keep account administration online only"
```

---

### Task 11: Add Windows build, test, and publish workflow

**Files:**
- Create: `.github/workflows/build-windows.yml`

**Interfaces:**
- Produces artifact `Gestion-Presence-FST-Windows-x64` containing the published executable and `web/index.html`.

- [ ] **Step 1: Add workflow with test gate before publish**

```yaml
name: Build Windows
on:
  push:
    branches: [main, feature/windows-offline-sync]
  pull_request:

jobs:
  windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '8.0.x'
      - run: dotnet restore windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj
      - run: dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj --configuration Release --no-restore
      - run: dotnet publish windows/GestionPresenceFST/GestionPresenceFST.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o publish/windows-x64
      - uses: actions/upload-artifact@v4
        with:
          name: Gestion-Presence-FST-Windows-x64
          path: publish/windows-x64
```

- [ ] **Step 2: Run the same commands locally where possible**

```bash
dotnet restore windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj
dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj -c Release
dotnet publish windows/GestionPresenceFST/GestionPresenceFST.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o publish/windows-x64
```
Expected: exit 0; `publish/windows-x64/Gestion-Presence-FST.exe` exists and `publish/windows-x64/web/index.html` exists.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/build-windows.yml
git commit -m "ci: build and publish Windows desktop app"
```

---

### Task 12: Run end-to-end synchronization acceptance checks

**Files:**
- Create: `windows/GestionPresenceFST.Tests/Integration/SyncAcceptanceTests.cs`
- Modify only production files if a failing acceptance test reveals a defect.

**Interfaces:**
- Verifies the complete contract defined by the spec.

- [ ] **Step 1: Add deterministic acceptance tests with an in-memory/fake remote**

Required scenarios:
```text
1. authenticated online sync downloads remote rows into SQLite
2. app restart reads cached rows without remote access
3. offline attendance/grade update survives restart
4. returning online pushes the queued update
5. remote HTML-side update is pulled into Windows cache
6. concurrent remote/local update creates a conflict and preserves both values
7. Keep Windows resolves by writing against the latest remote version
8. Keep Supabase replaces local data and clears the conflict
9. remote deletion removes clean local rows
10. remote deletion plus local pending edit creates a conflict
11. sensitive admin mutation is rejected offline
12. date state mapping remains identical for HTML and Windows WebView
```

- [ ] **Step 2: Run full test suite**

```bash
dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj -c Release
```
Expected: 0 failures.

- [ ] **Step 3: Run static HTML checks**

Verify exactly one effective teacher login implementation and required markers:
```bash
grep -c "function loginTeacher" web/index.html
grep -c "teacher_directory" web/index.html
grep -c "window.FSTNative" web/index.html
grep -c "getSessionDateState" web/index.html
```
Expected: login count `1`; all other markers at least `1`.

- [ ] **Step 4: Publish Windows package again**

```bash
dotnet publish windows/GestionPresenceFST/GestionPresenceFST.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o publish/windows-x64
```
Expected: exit 0 and executable present.

- [ ] **Step 5: Manual two-client smoke test against Supabase**

Use a non-destructive test record owned by the signed-in account:
1. HTML browser changes a test attendance/comment value.
2. Windows `Synchroniser maintenant` pulls it and displays the same value.
3. Disconnect Windows; modify the same test value locally; confirm orange pending indicator.
4. Reconnect; confirm it synchronizes and HTML sees the change.
5. Repeat with an intentional concurrent edit; confirm red conflict state and no silent overwrite.
6. Resolve once with `Conserver Windows` and once with `Conserver Supabase`.
7. Confirm blue session dates become green only after `completed_at` is set.

- [ ] **Step 6: Commit acceptance tests/fixes**

```bash
git add windows/GestionPresenceFST.Tests web/index.html windows/GestionPresenceFST
git commit -m "test: verify Windows offline synchronization"
```

---

## Final Verification Checklist

Run fresh before claiming completion:

```bash
dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj -c Release
dotnet publish windows/GestionPresenceFST/GestionPresenceFST.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o publish/windows-x64
```

Then verify:

- `Gestion-Presence-FST.exe` exists.
- `web/index.html` is bundled.
- no service-role/secret key exists in repository output.
- all offline entities are account-scoped.
- Admin/Super Admin operations remain online-only.
- browser HTML still works without `window.chrome.webview`.
- pending changes survive restart.
- full snapshot pull detects remote deletions.
- conflicts never auto-resolve by last-write-wins.
- gray/orange/blue/green/red date-state rules match the specification.
