# Web Standalone Professional Rebuild Design

## Objective

Rebuild the Web application as one reliable standalone HTML file while preserving the current Supabase production backend, attendance data, teacher/admin workflows, reports, statistics, and the 2026/2027 academic-year behavior. The rebuild must remove the current layered-patch architecture that causes duplicated runtime functions and fragile startup behavior.

## User-facing scope

The deliverable is a single file named `Gestion-Presence-FST-Web-2026-2027.html`. It must open directly in a modern desktop browser without requiring a ZIP archive or a local web server. Network access is still required for Supabase business data and authentication.

Only teachers and administrators authenticate. Students never receive application accounts. Authentication uses identifier plus password/PIN only. MFA, TOTP enrollment, MFA challenge screens, account-security navigation, and AAL2 enforcement are excluded from the Web UI and business flow.

## Root cause addressed

The current Web build starts from a legacy monolithic HTML file, applies a compressed historical patch, then appends several JavaScript layers such as runtime fixes, security overrides, MFA disabling, access control, session permissions, editing, statistics, and PDF reporting. Multiple layers redefine overlapping functions including authentication and session restoration. This makes startup order significant and allows a CI build to succeed even when the browser runtime is fragile.

The rebuilt application will have one authoritative implementation for each responsibility and a deterministic boot sequence.

## Architecture

The source remains browser-native HTML/CSS/JavaScript so the final artifact can remain one HTML file. Development source is split by responsibility and bundled at release time into a single standalone file.

The runtime units are:

- `web/app-shell.js`: boot sequence, route/view selection, global application state, and fatal-startup handling.
- `web/auth.js`: teacher/admin login, Supabase session restoration, logout, role validation, and profile loading.
- `web/api.js`: all Supabase table/RPC/Edge Function calls and normalized error mapping.
- `web/attendance.js`: session loading, attendance editing, revision tracking, idempotent save operations, and conflict handling through `save_attendance_sheet`.
- `web/administration.js`: administrator-only teacher, class, timetable, and student management supported by the existing backend policy.
- `web/reports.js`: reporting, statistics, and PDF generation.
- `web/ui.js`: DOM rendering helpers, notifications, dialogs, loading states, empty states, and navigation interaction.
- `web/styles.css`: professional institutional visual system and responsive rules.
- `web/index.template.html`: semantic page shell with no business logic.
- `scripts/build_single_file_release.py`: deterministic bundling of local source and vendored browser libraries into one HTML file.

No runtime file may redefine a function owned by another unit. Shared state is exposed through one `FSTApp` namespace instead of unrelated global overrides.

## Boot sequence

The final HTML executes in this order:

1. Embedded CSS and local assets are available.
2. Embedded Supabase client library is loaded.
3. Core application modules are registered without starting business actions.
4. `DOMContentLoaded` starts `FSTApp.boot()` exactly once.
5. Boot validates required browser APIs, initializes the Supabase client, restores an existing session if possible, loads the authenticated profile, and renders either the login view or the application shell.
6. A startup exception is caught and rendered as a visible diagnostic error panel instead of leaving a blank page.

There is one login function and one session-restore function in the final executable artifact.

## Supabase integration

The production project remains `dbslzmvzbxczpqyektpx`. The public/publishable key may remain embedded because browser clients require a public key; authorization continues to be enforced by Supabase Auth, RLS, RPCs, and server-side privileged functions.

Login continues through the existing `pin-login` server path and establishes a real Supabase session. The profile returned after login determines teacher versus administrator mode. The Web client never trusts a UI role selector alone for privilege.

Attendance saves continue through:

`save_attendance_sheet(session_id, expected_revision, operation_id, records[])`

Each save sends the current expected revision and a unique operation ID. `VERSION_CONFLICT` is shown as an explicit conflict state and forces a refresh/reconciliation instead of silently overwriting newer server data.

The application is online-only for authoritative business operations. It must not queue unsaved attendance mutations in localStorage for later replay. Local storage may contain non-sensitive UI preferences only. Loss of connectivity must disable authoritative writes and show a clear `Connexion Internet requise` state.

## Authentication and authorization

The login page contains only:

- role context: Enseignant or Administration;
- identifier;
- `Mot de passe ou PIN`;
- `Se connecter`.

No MFA-related control or text is rendered. A valid authenticated session is required for business data. Administrator views are rendered only after the loaded profile confirms administrator privileges. Teacher views are restricted to the data exposed by backend RLS and supported APIs.

Session expiration or a 401/invalid-JWT response returns the user to the login screen with a concise message and clears only local session/UI state; it never deletes business data.

## Professional interface

The visual direction is institutional and restrained rather than decorative. The application uses a neutral light surface, Tunis El Manar/FST-oriented blue accent, consistent spacing, readable typography, compact data tables, clear action hierarchy, and accessible status colors.

Desktop layout uses a persistent application header and clear primary navigation. Narrow widths collapse navigation without horizontal page breakage. Tables remain horizontally scrollable where needed. Forms use explicit labels, validation messages, disabled/loading button states, and consistent modal/dialog behavior.

The interface must provide distinct states for loading, empty data, offline/network error, permission denied, validation error, save success, and revision conflict. No action should appear successful before its server response succeeds.

Font Awesome or any other CDN-only visual dependency is removed from the final artifact. Required icons are implemented with inline SVG or CSS so the UI still renders when third-party CDNs are unavailable.

## Data integrity and security

The rebuild must not change production data schemas or destructive database behavior. Existing production data remains untouched.

The client must not contain service-role secrets, administrator database credentials, or privileged bypass logic. HTML escaping or safe DOM APIs are required for user-controlled values. Dynamic HTML interpolation is prohibited for untrusted values unless escaped through one tested helper.

Attendance, timetable, class, student, teacher, and report operations must preserve the existing backend authorization model. Administrator-only mutations continue through server-side privileged functions where already required.

## Build strategy

The release builder assembles `web/index.template.html`, `web/styles.css`, the local JavaScript modules, and vendored Supabase/jsPDF dependencies into one deterministic HTML artifact. It must not build by applying `scripts/web-superadmin.patch.part*` to the historical HTML.

The historical HTML remains available only as a reference during migration until parity tests pass; it is not executed in the final release path.

The build fails if the final file contains external `<script src>` dependencies, duplicate DOM IDs, multiple definitions of the canonical login/session boot functions, MFA APIs/text, or missing required Supabase/attendance markers.

## Test strategy

Tests are expanded from marker checks to executable behavior.

1. Unit/contract tests verify authentication normalization, safe rendering, role gating, attendance payload construction, revision-conflict mapping, and online-only write behavior.
2. Post-build structural tests parse the generated HTML and reject duplicate IDs, external script dependencies, duplicate canonical functions, MFA code, and incorrect dependency order.
3. A headless Chromium smoke test opens the generated `file://` HTML artifact and verifies that the login screen renders, no uncaught startup exception occurs, required fields/buttons are visible, and the page does not remain blank.
4. Browser tests use a stubbed network layer for deterministic login/error rendering where production credentials are not available in CI; production Supabase is not modified by CI.
5. The GitHub Actions Web workflow runs all tests, builds the standalone artifact, runs the browser smoke test, verifies SHA-256 output, and uploads exactly the standalone release artifact plus its checksum metadata.

## Migration sequence

1. Add browser smoke-test infrastructure and first reproduce the current blank/broken startup as a failing regression test.
2. Introduce the new template, style system, and single application namespace while preserving the login screen contract.
3. Move authentication/session behavior into one module and remove legacy overrides.
4. Move Supabase data access into one API module.
5. Migrate attendance and conflict-safe saving.
6. Migrate administration, reports, statistics, and PDF features.
7. Remove the historical patch from the release build.
8. Run parity, browser, syntax, security-contract, and final-artifact tests before publishing.

## Acceptance criteria

The rebuild is accepted only when all of the following are verified on the generated artifact:

- one downloadable `.html` file is the primary Web deliverable;
- opening the file directly in Chromium/Chrome displays the login screen instead of a blank/broken application;
- no external JavaScript or icon CDN is required for startup/UI rendering;
- no MFA/TOTP UI, API call, challenge, or business-write requirement exists in the Web client;
- only teacher/admin authentication is exposed;
- successful authentication establishes/restores a Supabase session and loads the authorized profile;
- failed authentication, lost connectivity, expired session, permission denial, and startup failure each render a clear user-visible state;
- attendance saves use the atomic revision/idempotency RPC and never silently overwrite a conflict;
- administrator navigation is unavailable to non-admin profiles;
- reports/statistics/PDF and current core presence workflows remain available;
- no production database migration or data deletion is required by this rebuild;
- all unit, contract, post-build, and headless-browser smoke tests pass in GitHub Actions;
- the released HTML checksum is generated and verified before artifact upload.
