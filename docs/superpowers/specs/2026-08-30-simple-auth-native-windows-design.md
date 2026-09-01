# Gestion Présence FST — Simple Authentication and Native Windows Design

Date: 2026-08-30
Status: Approved design pending final written-spec review

## 1. Objective

Update the three application forms so that teachers and administrators authenticate with exactly one primary credential flow: username plus PIN, or username plus password. Remove MFA/TOTP and any second-factor/AAL2 requirement from Web, Android, Windows, RPC authorization and privileged application workflows.

Replace the current Windows WPF/WebView2 host with a conventional fully native Windows application implemented in WPF/.NET 8 using XAML, C#, MVVM and native controls. Windows must not embed, render or depend on the Web HTML application or WebView2.

Supabase remains the single backend and source of truth shared by Web, Android and Windows.

## 2. Authentication Contract

Both roles, `teacher` and `admin`, support the same two alternatives:

1. username + PIN; or
2. username + password.

A successful primary authentication returns the normal Supabase session/JWT and immediately opens the authorized application. There is no TOTP enrollment, TOTP challenge, MFA screen, second verification screen or AAL2 gate.

PIN validation remains server-side. Clients never store or compare a PIN hash. Password authentication uses the server-controlled/Supabase authentication path. Failed-attempt throttling, account/network rate limiting and generic login errors remain enabled.

Authorization remains independent from authentication. The authenticated user role and database state determine access. Clients must never grant admin privileges from editable client metadata.

## 3. Security Preserved After MFA Removal

Removing MFA does not remove backend security controls. The system retains:

- Supabase JWT sessions;
- PostgreSQL RLS;
- teacher ownership/assignment checks;
- admin authorization checks;
- server-side PIN hashing and validation;
- rate limiting and temporary lockout;
- session expiration and refresh;
- audit logging;
- revision-based optimistic concurrency;
- idempotent write operations;
- atomic attendance transactions;
- explicit `VERSION_CONFLICT` handling;
- private/revoked privileged database objects.

Functions currently requiring `aal2` must instead require a valid authenticated session plus the required application role/ownership. No business operation may rely on MFA state after migration.

## 4. Web Client

The Web application remains HTML/CSS/JavaScript and preserves the approved final HTML behavior and visual reference.

Authentication UI is reduced to username, credential type (PIN/password where necessary), credential input and login action. MFA enrollment/challenge components and `challengeAndVerify` flows are removed.

After authentication, Web continues to use the common Supabase contract, RLS, atomic attendance RPC, reports and administrative APIs.

## 5. Android Client

Android remains a native Kotlin/Jetpack Compose online-only application. It must contain no business WebView, Room business database, offline mutation queue or WorkManager synchronization pipeline.

The login screen supports username + PIN or username + password. TOTP/MFA UI and AAL2 checks are removed. Session material continues to be protected using Android platform secure storage/Keystore mechanisms.

The existing PostgREST singleton-response regression fix remains required: endpoints that semantically return one row must safely accept a JSON object or a one-element JSON array and reject ambiguous multi-row responses.

## 6. Windows Client — Fully Native WPF

The existing `GestionPresenceFSTOnline` WebView2 wrapper is not the target product and must be retired from the official build.

The official Windows application will use:

- .NET 8 Windows;
- WPF;
- XAML views;
- C# ViewModels and services;
- MVVM separation;
- `HttpClient`/typed backend services for Supabase/Edge Functions;
- native `DataGrid`, forms, dialogs, menus, navigation and validation;
- Windows secure credential/session storage where persistence is required.

The official Windows project must have no `Microsoft.Web.WebView2` package, no `<WebView2>` control, no embedded `web/index.html`, no HTML renderer and no JavaScript bridge.

### Windows functional parity

Native Windows must provide the same business capabilities required from the common product contract:

- login/logout and session restoration;
- dashboard;
- classes/groups;
- timetable;
- teachers where authorized;
- students/enrollments;
- sessions;
- attendance entry/editing;
- attendance completion;
- grades/comments where applicable;
- reports/statistics;
- account information;
- administrative teacher management for admins;
- explicit conflict/error handling.

Views communicate only through ViewModels/services; ViewModels depend on repository/service interfaces rather than XAML controls.

## 7. Shared Backend and Data Flow

The three clients use the same production Supabase project and canonical database records.

Client -> authentication endpoint -> Supabase session -> repository/API calls -> RLS/RPC/Edge Function -> canonical database result -> client state.

Attendance writes continue through the atomic versioned operation rather than independent row-by-row writes. All clients must display a conflict and reload canonical state when `VERSION_CONFLICT` occurs; none may silently overwrite concurrent changes.

## 8. Backend Migration

Migration is additive/reversible and must preserve existing production users and attendance data.

Required changes:

1. remove AAL2/MFA checks from business RPCs/functions;
2. preserve authenticated-user and role/ownership checks;
3. support the password and PIN login alternatives;
4. remove client dependency on MFA-specific response fields;
5. keep PIN credential data private and non-readable by client roles;
6. validate Web, Android and Windows against staging/test before production deployment;
7. retain rollback scripts/versioned migrations.

Existing TOTP factors may remain in Supabase Auth records if destructive removal is unnecessary, but the applications and business authorization must not require or prompt for them.

## 9. Error Model

Common client-visible errors remain typed and non-sensitive:

- `NETWORK_UNAVAILABLE`
- `UNAUTHENTICATED`
- `SESSION_EXPIRED`
- `FORBIDDEN`
- `VALIDATION_ERROR`
- `VERSION_CONFLICT`
- `RATE_LIMITED`
- `SERVER_UNAVAILABLE`
- `INTERNAL_ERROR`

`MFA_REQUIRED` is removed from normal application behavior.

## 10. Testing and Acceptance

Authentication tests must validate PIN and password flows without requiring real interactive MFA/TOTP authentication. Security tests must still verify unauthenticated denial, teacher isolation, admin authorization, invalid PIN/password handling, throttling and session expiry.

Windows acceptance requires automated checks proving the official project contains no WebView2 dependency or embedded Web HTML.

Final acceptance criteria:

- Web: username + PIN/password only; no MFA UI/gate.
- Android: username + PIN/password only; no MFA UI/gate; native Compose and online-only.
- Windows: username + PIN/password only; 100% native WPF business UI; no WebView2/HTML.
- Teacher/admin access enforced by backend RLS/authorization.
- Existing production data preserved.
- Attendance remains atomic, revision-aware, idempotent and audited.
- Cross-client writes are visible from all three clients against the same backend.
- Web, Android and Windows build/test pipelines are green before release.
