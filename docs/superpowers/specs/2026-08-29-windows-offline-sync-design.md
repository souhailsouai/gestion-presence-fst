# Gestion Présence FST — Windows Offline Sync Design

Date: 2026-08-29
Branch: `feature/windows-offline-sync`

## 1. Objective

Extend the existing Windows application so that it remains synchronized with the HTML application through the same Supabase backend, while supporting offline work on Windows. Preserve the existing HTML user experience and authorization model, including the unique Super Admin capability.

## 2. Existing baseline

The repository already contains a Windows desktop application implemented with .NET 8 WPF and Microsoft WebView2 under `windows/GestionPresenceFST`. The Windows client loads the HTML application inside WebView2. Supabase remains the central remote source of truth for authenticated users and synchronized data.

## 3. Target architecture

The Windows application will keep WPF + WebView2 and add a native local-data and synchronization layer:

`HTML / WebView2 -> JavaScript-C# bridge -> LocalDataService -> SQLite -> SyncQueueService -> SyncService -> Supabase`

The browser HTML application continues to use Supabase directly. The Windows application uses the same UI and same Supabase project, but can transparently read/write local SQLite data when offline.

### Components

- `LocalDataService`: SQLite storage for synchronized pedagogical data.
- `SyncQueueService`: durable queue of pending INSERT/UPDATE/DELETE operations.
- `SyncService`: push local operations to Supabase and pull remote changes.
- `ConflictService`: detect and resolve concurrent edits using `updated_at`.
- `ConnectivityService`: detect network availability and trigger automatic sync.
- `WebViewBridge`: expose local/offline operations from C# to JavaScript without changing browser behavior.

Each component must have a narrow responsibility and be independently testable.

## 4. Local SQLite scope

Offline-capable entities:

- `classes`
- `students`
- `sessions`
- `attendance`

The local schema mirrors the Supabase UUID primary keys and relevant columns. New Windows records created offline receive UUIDs immediately so related records can be created before synchronization.

Local metadata must also store:

- last known remote `updated_at`
- local sync state
- last successful synchronization timestamp
- pending operation metadata
- conflict metadata when required

A dedicated `sync_queue` table stores pending writes.

## 5. Synchronization behavior

### Startup

1. Open SQLite.
2. Load cached local data immediately.
3. Restore the authenticated user session when possible.
4. Check connectivity.
5. If online, synchronize silently.
6. Refresh the visible data only when newer remote data is received.

### Online write

A Windows write is first committed to SQLite. It is then sent to Supabase. On success, local synchronization metadata is updated.

### Offline write

A Windows write is committed to SQLite and inserted into `sync_queue`. The UI remains usable. The queue is processed automatically when connectivity returns.

### Shutdown

Pending writes remain durable in SQLite and are retried on the next launch. No local edit is discarded merely because the application closes while offline.

## 6. Conflict detection

Supabase tables `classes`, `students`, `sessions`, and `attendance` already expose `updated_at`. Windows stores the known remote timestamp when a local edit begins.

Before pushing an update, Windows compares:

- local base version timestamp
- current remote `updated_at`

If they differ and both sides changed the same record after the local base version, Windows must not silently overwrite the remote value. A conflict record is created.

The conflict UI presents:

- Windows value
- Supabase value
- `Conserver Windows`
- `Conserver Supabase`

Conflict resolution writes the selected version, updates local state, and removes the resolved conflict.

For deletes, deletion versus concurrent remote modification is treated as a conflict instead of silently destroying modified data.

## 7. Security model

Supabase remains authoritative for authentication and authorization. Existing RLS and Edge Function rules continue to apply.

Offline-capable pedagogical operations:

- classes/groups
- students
- sessions
- attendance
- grades
- timetable data contained in synchronized class/session records

Always-online sensitive operations:

- create account
- reset/change password or PIN
- promote Admin
- remove Admin
- Super Admin operations
- any authorization-role change

Offline mode is available only to a user who has previously authenticated successfully on that Windows installation. Cached data is scoped to the authenticated account.

No service-role or secret Supabase credential may be embedded in Windows or HTML.

## 8. HTML and Windows synchronization

Supabase is the shared remote source of truth.

- A change made in browser HTML is pulled into Windows during synchronization.
- A Windows online change is pushed to Supabase and becomes visible to HTML.
- A Windows offline change is queued and pushed when connectivity returns.
- The same UUIDs are preserved across clients.

The design must avoid creating a separate remote Windows database.

## 9. Date and session color states

The HTML application and Windows application must use the same session-date visual states.

- Gray: date available, no confirmed session.
- Orange: date selected in the form but not yet confirmed.
- Blue: session created/confirmed, attendance not yet completed.
- Green: session completed (`completed_at` set) and final session workflow completed.
- Red: synchronization error or unresolved conflict for that session.

The same state rules apply to:

- date selector after user selection
- session list
- attendance view
- dashboard/session summaries
- Windows WebView UI

Transient orange state is local UI state. Blue/green/red confirmed states are derived from synchronized application data so that HTML and Windows converge on the same color after synchronization.

## 10. Synchronization status indicator

Use a compact color-only indicator with accessible tooltip/title text:

- Green: synchronized
- Orange: pending local changes
- Blue: synchronization in progress
- Red: error or conflict
- Gray: offline

The Windows UI may also show the number of pending operations and expose `Synchroniser maintenant`, but must not use a large persistent status banner.

## 11. User interface constraints

Preserve the existing functional HTML interface rather than redesigning it. Windows should continue to render that interface through WebView2.

Add only what is required for offline/sync behavior:

- sync indicator
- pending count
- manual sync action
- conflict view when conflicts exist
- shared date-state colors

The Administration behavior, teacher directory, persistent session behavior, and Super Admin restrictions must remain unchanged.

## 12. Error handling

- Network failures never discard local edits.
- Failed sync operations remain queued with retry metadata.
- Authentication failure stops remote synchronization but preserves local data.
- Authorization/RLS failures are surfaced as non-retryable until user/action changes.
- Conflict failures are surfaced separately from connectivity failures.
- Corrupt or unavailable SQLite storage must fail safely and must not trigger destructive remote actions.

## 13. Testing strategy

Implement with tests before production changes.

Required test groups:

- SQLite repository CRUD and account scoping
- sync queue durability
- online write flow
- offline write/retry flow
- pull remote changes
- UUID preservation
- timestamp conflict detection
- conflict resolution choices
- deletion conflict handling
- sensitive actions blocked offline
- JavaScript-C# bridge contract
- session/date color-state mapping
- startup session/cache behavior

Integration verification must include a browser/HTML change becoming visible in Windows and a Windows change becoming visible through Supabase to the HTML client.

## 14. Non-goals

- Replacing WPF/WebView2 with Tauri or Electron.
- Creating a second remote database.
- Allowing offline Admin/Super Admin role changes.
- Redesigning the existing HTML interface.
- Silently resolving concurrent edits by last-write-wins.

## 15. Acceptance criteria

The design is complete when:

1. Windows launches and displays cached pedagogical data without Internet after at least one successful authenticated sync.
2. Offline attendance/grade/session edits persist across application restart.
3. Pending edits synchronize automatically when Internet returns.
4. Browser HTML and Windows converge on the same Supabase data.
5. Concurrent edits are detected and require explicit resolution.
6. Sensitive account and role operations remain online-only and protected by existing server authorization.
7. Session date colors follow the same gray/orange/blue/green/red state rules in HTML and Windows.
8. Existing teacher directory, persistent session, Admin, and Super Admin behavior remain intact.
