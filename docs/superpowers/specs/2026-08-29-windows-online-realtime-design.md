# Windows Online Realtime Design

## Objective
Replace the abandoned offline-first Windows direction with a strictly online architecture. The Windows desktop application must use the same hosted HTML interface as the browser application and the same Supabase backend. No pedagogical data is stored locally for offline synchronization.

## Scope
The design applies to the Windows WPF/WebView2 client, the shared web interface, GitHub Pages deployment, Supabase Realtime, network-loss behavior, and validation. Existing authentication, teacher, Admin, Super Admin, attendance, grade, student, class, and session flows must remain functional.

## Architecture
The browser and Windows clients use a single shared `web/index.html`.

Production flow:

`Browser -> GitHub Pages -> web/index.html -> Supabase`

`Windows WPF/WebView2 -> GitHub Pages -> web/index.html -> Supabase`

Supabase remains the single source of truth. Windows does not use SQLite, a local synchronization database, an offline mutation queue, local conflict tables, or delayed writes.

The Windows executable is a thin WPF/WebView2 host that navigates to the deployed HTTPS application URL. Updating the shared HTML therefore updates both browser and Windows behavior without rebuilding the executable unless native host behavior itself changes.

## Hosting and Deployment
The shared application is hosted on the repository's standard GitHub Pages URL:

`https://souhailsouai.github.io/gestion-presence-fst/`

The login page may be publicly reachable. Application data remains protected by Supabase Auth, RLS, server-side authorization, and existing Edge Functions/RPCs.

Deployment is production-only from `main`:

`feature branch -> automated tests -> merge to main -> GitHub Pages deployment`

Feature branches must not publish over the production site.

## Windows Network Behavior
The Windows application requires Internet access for all data operations.

If Windows starts without Internet connectivity or cannot reach the hosted application/backend, the application remains open and presents a clear `Connexion Internet requise` state.

If connectivity is lost while the application is already open:

- write actions are blocked;
- no mutation is queued locally;
- no pedagogical change is persisted offline;
- already-rendered data may remain visible as read-only UI state;
- when connectivity returns, the application refreshes authoritative data from Supabase before resuming normal operation.

The application must not claim that a change was saved unless Supabase has accepted it.

## Supabase Realtime
Realtime is enabled only for these pedagogical tables:

- `classes`
- `students`
- `sessions`
- `attendance`

The shared HTML subscribes to INSERT, UPDATE, and DELETE events needed to refresh the current workspace automatically. A change made in the browser must appear in Windows without manual reload, and the reverse must also hold because both clients use the same application code and backend.

Realtime is an update mechanism, not the authoritative persistence layer. After reconnection, after a subscription failure, or when consistency is uncertain, the client performs a normal Supabase refresh and rebuilds UI state from authoritative rows.

RLS remains enabled and must continue to restrict which rows an authenticated user may read or mutate. Realtime must not introduce broader permissions than the normal Data API path.

## Authentication and Authorization
Existing Supabase authentication and role behavior remain in force. The client may use only public/publishable credentials appropriate for frontend use. No `service_role` or secret server credential may be embedded in HTML or the Windows executable.

Existing teacher/Admin/Super Admin server-side protections remain unchanged. Sensitive account operations continue through their current authorized server-side paths and require connectivity.

Persistent authenticated session restoration in the shared HTML remains supported.

## Shared UI Behavior
The current approved functional interface is preserved. Windows and browser must render the same interface from the same deployed HTML.

Date-state semantics are shared across both clients:

- gray: available date / no confirmed session;
- orange: currently selected but not confirmed;
- blue: confirmed or created session, attendance not completed;
- green: completed session (`completed_at` present);
- red: application/server error requiring user attention.

Realtime changes that affect a session must trigger recalculation of the affected date/session presentation.

The previous offline synchronization status colors, pending-operation indicators, and conflict-resolution UI are removed from scope because there is no offline write queue.

## Removal of Previous Offline Direction
The earlier Windows offline-sync design is superseded by this document.

Production Windows code must not depend on the previously introduced offline synchronization subsystem. The following concepts are explicitly out of scope and should be removed or excluded from the production composition when implementation begins:

- SQLite pedagogical cache as authoritative working storage;
- `sync_queue`;
- `sync_conflicts`;
- local-vs-remote conflict resolution;
- deferred INSERT/UPDATE/DELETE;
- offline mutation replay;
- native REST synchronization pipeline used only to reconcile local state.

Tests written exclusively for the abandoned offline architecture should be removed or replaced by online-host/realtime/network-behavior tests.

## Windows Host Responsibilities
The native WPF layer is intentionally small. It is responsible for:

1. initializing WebView2;
2. navigating to the production HTTPS GitHub Pages URL;
3. presenting a native fallback/error state when navigation cannot succeed;
4. detecting navigation/network failure sufficiently to show `Connexion Internet requise` and permit retry;
5. preventing local HTML-file fallback from becoming a divergent second production UI.

Pedagogical CRUD logic remains in the shared HTML/Supabase application rather than being duplicated in C#.

## Error Handling
Network errors must be explicit and non-destructive. A failed mutation shows an error and the UI reloads/retains authoritative server state rather than pretending success.

Realtime channel errors should trigger retry logic and, after successful reconnection, a full affected-data refresh.

Authentication expiry follows the existing Supabase session flow. If a session cannot be refreshed, the user returns to the login state rather than receiving stale privileged access.

## Validation
Automated validation must cover at least:

- the Windows host targets the approved HTTPS application URL;
- no production dependency on SQLite/offline sync remains;
- browser-side Supabase configuration and existing authentication markers remain present;
- Realtime subscriptions exist for `classes`, `students`, `sessions`, and `attendance`;
- date-state logic preserves gray/orange/blue/green/red semantics;
- writes are blocked or fail clearly when connectivity is unavailable;
- reconnect performs authoritative refresh;
- Windows `win-x64` build/publish succeeds in GitHub Actions.

Manual two-client smoke validation must confirm:

1. log into browser and Windows;
2. modify attendance or grade in one client;
3. observe the other client update without manual reload;
4. repeat with a session/student/class mutation where permitted;
5. disconnect Windows network and confirm no local write is accepted;
6. reconnect and confirm authoritative state is restored/refreshed;
7. verify teacher, Admin, and Super Admin flows still behave according to existing authorization.

## Acceptance Criteria
The feature is complete when:

- Windows loads the production GitHub Pages application through WebView2;
- browser and Windows use the same production HTML;
- Supabase is the only persistence source for pedagogical data;
- there is no offline pedagogical write capability;
- network loss produces a clear online-required state;
- Realtime updates are visible across browser and Windows without manual reload;
- reconnect refreshes authoritative Supabase state;
- existing auth and role protections remain intact;
- GitHub Pages deploys production only from `main`;
- GitHub Actions produces a successful Windows x64 artifact after all relevant tests pass.
