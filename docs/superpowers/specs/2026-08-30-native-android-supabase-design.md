# Native Android and Supabase Architecture Design

**Project:** Gestion de Presence FST 2026/2027  
**Date:** 2026-08-30  
**Status:** Approved design; implementation not started  
**Repository:** `souhailsouai/gestion-presence-fst`

## 1. Purpose

Migrate the current Android application from a Java `WebView` wrapper to a native Android application implemented in Kotlin and Jetpack Compose, while preserving the functional behavior and institutional identity of the final HTML application.

The Web/HTML, Windows, and Android clients shall use the same Supabase backend and the same business contracts. Supabase PostgreSQL is the only authoritative data source. Clients shall never synchronize directly with one another.

## 2. Verified baseline

### Repository

The current Android release is version `1.2.0`, package `tn.utm.fst.gestionpresence`, `minSdk 24`, `targetSdk 35`. It consists of one Android application module and a Java `MainActivity` that loads `app/src/main/assets/index.html` into a `WebView` and injects mobile CSS and JavaScript.

The Windows application is a .NET 8 WPF shell using Microsoft WebView2 and the canonical web HTML. The existing Android and Windows clients therefore reuse the web implementation rather than implement independent native business layers.

### Functional reference

The authoritative UI and functional reference is the latest file named:

`Gestion-Presence-FST-HTML-Final-2026-2027.html`

The selected copy was created on 2026-08-30 at 09:36:40 UTC. Before implementation, that exact file shall be imported into the repository under `reference/`, its SHA-256 checksum recorded, and its behavior converted into a traceable parity matrix. Later HTML copies do not become authoritative unless explicitly approved and assigned a new reference checksum.

### Existing Supabase backend

The production project is `Gestion-Presence`, project ref `dbslzmvzbxczpqyektpx`, region `eu-west-1`.

Existing public tables are:

- `profiles`
- `classes`
- `students`
- `sessions`
- `attendance`
- `admin_pin_credentials`
- `admin_pin_attempts`
- `super_admin_owner`

RLS is enabled on all listed tables. Existing privileged functions include `admin-teacher` and `admin-pin-login`.

The current model is operational but does not yet provide the complete target contract: normalized academic entities, immutable audit history, row revisions, idempotent attendance-sheet writes, soft deletion, explicit client compatibility, or transaction-level conflict detection.

## 3. Binding decisions

1. The final HTML is the functional and visual reference.
2. Android shall be native Kotlin/Jetpack Compose; no production `WebView` shall render application screens.
3. Android is online-only for all business data and operations.
4. No student account shall exist. Only teachers and administrators authenticate.
5. Supabase is the single source of truth for Web, Windows, and Android.
6. MFA is mandatory for administrators and teachers under the policies defined below.
7. Concurrent modifications shall never use silent last-write-wins behavior.
8. The native Android client shall use a multi-module MVVM/Clean Architecture structure.
9. Privileged administration shall execute only on the server through authenticated Edge Functions or tightly scoped PostgreSQL functions.
10. Existing production data shall be preserved through additive, reversible migrations.

## 4. Scope

### Included

- Native Android authentication, MFA, navigation, dashboard, classes/groups, timetable, teacher directory, students, sessions, attendance, reports, account security, and administration.
- Supabase schema evolution, RLS hardening, transactional RPCs, audit logging, conflict detection, and common error contracts.
- Shared behavior contract for Web, Windows, and Android.
- Automated tests and Android CI build.
- Migration from the current Android WebView implementation.

### Excluded

- Student login or student self-service.
- Android offline attendance entry, Room business database, background synchronization queue, or local conflict resolution.
- Direct client use of a Supabase secret/service-role key.
- Pixel-identical reproduction of the HTML. Functional parity and institutional visual identity are required; Android interaction patterns shall remain native.
- Rewriting the Windows client in another framework without a separate approved design.

## 5. System architecture

```text
Web/HTML client -----------\
Windows WPF/WebView2 -------+--> Supabase Auth + PostgreSQL + Realtime
Native Android/Compose ----/          |        |          |
                                      |        |          +-- change notification
                                      |        +------------- RLS and transactional RPC
                                      +---------------------- MFA and session management

Privileged operations ----------------> authenticated Edge Functions
```

Supabase PostgreSQL owns integrity, authorization, revisions, idempotency, and auditability. Client-side validation improves usability but never replaces server constraints.

## 6. Android architecture

### Modules

```text
app
core:common
core:model
core:network
core:security
core:designsystem
core:testing
feature:auth
feature:dashboard
feature:classes
feature:timetable
feature:teachers
feature:students
feature:sessions
feature:attendance
feature:reports
feature:admin
feature:account
```

Each feature contains `presentation`, `domain`, and `data` packages. Feature modules depend on core modules, not on one another. Cross-feature navigation uses typed route contracts owned by `app`.

### Layer flow

```text
Compose screen
  -> ViewModel
  -> Use case
  -> Repository interface
  -> Supabase repository implementation
  -> PostgreSQL/RPC/Edge Function
  -> typed result
  -> immutable UI state
```

Compose screens shall contain no SQL, Supabase query construction, authorization logic, token handling, or business validation.

### Android technology choices

- Kotlin
- Jetpack Compose and Material 3
- Navigation Compose with typed routes
- Coroutines and Flow
- Hilt for dependency injection
- Kotlin serialization for transport models
- Supabase Kotlin client with versions pinned in the version catalog and lockfiles committed where supported
- Android Keystore-backed protection for persisted session material using the current supported Android security API verified during implementation
- Gradle Kotlin DSL and a version catalog

No Room dependency shall be added for business data. A small preferences store may persist non-sensitive UI preferences. Sensitive session data shall not be written to plaintext preferences or logs.

## 7. Android navigation and screens

### Authentication graph

- Work mode selection: teacher or administrator
- Username and six-digit PIN entry
- MFA enrollment when required
- MFA challenge
- locked/rate-limited state
- password/PIN update and secure sign-out

### Main navigation

Bottom navigation:

- Home
- Sessions
- Attendance
- More

`More` contains:

- Classes and groups
- Timetable
- Teachers
- Students
- Reports
- Administration, visible only to authorized administrators
- Account security
- Change account
- Sign out

### Feature parity

The native application shall cover every approved capability present in the final HTML, including dashboard statistics, recent sessions, class/group management, timetable, teacher directory, student import and management, session creation, attendance status and comments, grades where present, session reports, aggregated reports, PDF/print/export actions, and authorized administration.

A parity matrix shall map every HTML control and workflow to its Android route, use case, backend operation, permission, and automated test.

## 8. Target data model

The current schema shall evolve additively toward the following target model:

- `profiles`: authenticated user profile, username, display name, role, account state, MFA policy.
- `academic_years`: active and archived academic years.
- `courses`: modules/subjects.
- `student_groups`: track, level, class, group, and academic year.
- `students`: institutional student identity.
- `enrollments`: student-to-group membership by academic year.
- `teacher_assignments`: teacher-to-course-to-group authorization.
- `timetable_entries`: planned timetable.
- `sessions`: actual teaching sessions linked to a valid assignment.
- `attendance_sheets`: one versioned aggregate per session.
- `attendance_records`: one row per student per session.
- `operation_receipts`: idempotency records for mutation requests.
- `audit_logs`: append-only audit records.
- `app_config`: minimum client versions, maintenance mode, and institutional configuration.

All business rows shall use UUID primary keys and UTC `timestamptz` audit fields. Mutable aggregates shall include a monotonically increasing integer `revision`. Referenced records shall use soft deletion or archival where physical deletion would break traceability.

### Required constraints

- Unique normalized username.
- One active enrollment per student/group/academic year according to the institutional rule.
- One attendance sheet per session.
- One attendance record per `(session_id, student_id)`.
- Attendance status restricted to the common enum: `present`, `absent`, `retard`, `justifie`.
- Grade, when used, restricted to `[0, 20]`.
- Session teacher, group, and course must match an active teacher assignment.
- Start time must precede end time.
- Foreign keys and check constraints remain authoritative even when clients validate the same rules.

## 9. Migration of current production data

Migrations shall be additive and executed first in a non-production environment.

1. Add revision, archival, operation, and audit infrastructure without changing current client behavior.
2. Create normalized academic tables.
3. Transform existing `classes` rows into `student_groups`, `courses`, `teacher_assignments`, and `timetable_entries` while preserving original UUID mappings in a migration map.
4. Transform current students and sessions into the normalized structure.
5. Create attendance sheets and attach existing attendance records.
6. expose backward-compatible security-invoker views/RPCs for the current Web and Windows clients during transition.
7. Validate row counts, foreign keys, representative reports, and per-teacher access before switching clients.
8. Remove compatibility paths only after all supported clients use the new contract.

Every migration shall include verification queries and a rollback strategy. Production schema changes shall be represented by versioned migration files.

## 10. Authentication and MFA

### User experience

The visible login remains `username + six-digit PIN`, preserving the approved HTML interaction. The PIN shall not be used as a low-entropy direct password against the public Supabase password endpoint.

A dedicated server-side login exchange shall:

1. normalize the username;
2. apply generic error messages;
3. enforce per-account and per-network rate limits;
4. verify a salted, computationally hardened PIN hash stored outside exposed schemas;
5. issue an AAL1 Supabase session through a server-controlled exchange;
6. require the appropriate MFA challenge before granting application access.

Internal Auth credentials shall be high entropy and unavailable to clients. PIN hashes, rate-limit state, and super-administrator ownership shall move from the exposed `public` schema into a non-exposed private schema with explicit privilege revocation.

### MFA policy

- Administrator: MFA required on each new device/session context and before privileged actions.
- Teacher: MFA required on first use of a new device and whenever the server risk/session policy requires reauthentication.
- Privileged actions require AAL2 and recent authentication.
- Recovery procedures are administrator-audited and shall not reveal existing credentials.

Authorization shall use server-controlled app metadata and database state, never user-editable user metadata.

## 11. Authorization and RLS

All exposed tables shall have RLS enabled and explicit policies.

### Teacher

A teacher may:

- read institutional directory/timetable data exposed through purpose-built views;
- manage only assigned classes/groups where the business rules permit;
- read students enrolled in assigned groups;
- create and modify only sessions derived from active assignments;
- record attendance only for owned sessions and valid enrolled students;
- read only authorized reports.

### Administrator

An administrator may perform institution-wide operations explicitly granted by policy. Administrator status does not bypass concurrency control, audit requirements, or MFA requirements.

### Super administrator

Only the protected owner account may grant or revoke administrator roles. That ownership record remains server-only.

Raw tables shall not be made broadly readable merely to support directory or timetable screens. Use security-invoker views or narrowly scoped RPCs. Any required `SECURITY DEFINER` function shall be placed in a non-exposed schema, revoke `EXECUTE` from `PUBLIC`, validate `auth.uid()`, set a safe `search_path`, and receive explicit grants only.

## 12. Security remediation required before release

The current Supabase security review identified items that shall be resolved before the native release:

- `teacher_directory()` is currently a public `SECURITY DEFINER` RPC executable by authenticated users. Replace it with a security-invoker design or move/restrict it as specified above.
- Leaked-password protection is currently disabled. Enable it for any remaining password-based recovery or administration flow.
- PIN credential, attempt, and super-admin tables are currently in `public` with RLS but no client policies. Move them to a private schema or fully revoke Data API access; RLS alone is not the intended boundary for server-only data.
- Current broad `SELECT true` policies on classes and sessions shall be replaced by purpose-specific authorized views or policies.
- Refactor the web application away from inline event handlers and monolithic inline JavaScript so a strict Content Security Policy can be enforced.
- No client may contain a secret/service-role key. Only the publishable key is permitted in public client configuration.
- Logs, analytics, crash reports, exports, and audit details shall redact tokens, PINs, MFA secrets, and unnecessary personal data.

## 13. Attendance transaction and conflict contract

Attendance shall be saved as one atomic aggregate operation:

```text
save_attendance_sheet(
  session_id,
  expected_revision,
  operation_id,
  records[]
)
```

The server shall:

1. validate the authenticated user and AAL level;
2. validate session ownership/authorization;
3. validate that all students are valid members of the session group;
4. reject duplicate or invalid student records;
5. compare `expected_revision` with the server revision;
6. apply all changes in one transaction;
7. increment the sheet revision once;
8. record an audit event and idempotency receipt;
9. return the canonical updated sheet and revision.

If revisions differ, the operation shall change no business row and return `VERSION_CONFLICT`. Repeating an already completed `operation_id` shall return the original canonical result rather than apply the operation twice.

Administrative corrections require a non-empty justification and create an immutable audit record.

## 14. Realtime and synchronization

Realtime is a change-notification mechanism, not an alternative source of truth.

When a permitted event arrives, a client invalidates the affected query and reloads canonical data through the authorized repository. It shall not blindly merge an event payload into authoritative UI state.

Android maintains only in-memory business data for the current process. When connectivity is unavailable:

- business screens show a clear `Connexion Internet requise` state;
- mutation controls are disabled;
- unsent attendance changes are not persisted as a background queue;
- the user must reload canonical data after connectivity returns.

Web and Windows remain backend clients during the migration. Any change to their existing offline behavior requires a separate compatibility review; their server writes must nevertheless adopt revisions, idempotency, and the common conflict contract.

## 15. Common error contract

All clients shall map server failures to stable codes:

- `NETWORK_UNAVAILABLE`
- `UNAUTHENTICATED`
- `SESSION_EXPIRED`
- `MFA_REQUIRED`
- `FORBIDDEN`
- `VALIDATION_ERROR`
- `VERSION_CONFLICT`
- `RATE_LIMITED`
- `SERVER_UNAVAILABLE`
- `INTERNAL_ERROR`

The server response shall include a correlation identifier. Clients shall display localized user messages, never raw PostgreSQL, JWT, or stack-trace text.

Reads may retry with bounded exponential backoff. Writes may retry only with an idempotent `operation_id` and only after checking whether the original operation was committed.

## 16. Imports, exports, reports, and personal data

- Student imports shall parse into a preview model, validate every row, report row-level errors, and require explicit confirmation before one transactional import.
- File type, size, required columns, encoding, and duplicate rules shall be validated server-side.
- Global exports, account management, and backup/restore operations shall run through privileged server functions with MFA and audit logging.
- Global restore is not a normal client-side action. It requires an administrated procedure, dry-run validation, and a restorable server backup.
- Reports shall be generated from canonical server data using the same date-period definitions across clients.
- Exports shall escape spreadsheet formula prefixes and use UTF-8 consistently.

## 17. Testing strategy

### Backend

- schema constraint tests;
- positive and negative RLS tests for teacher A, teacher B, administrator, anonymous, and expired sessions;
- direct UUID/IDOR attempts;
- MFA/AAL enforcement;
- transaction atomicity;
- concurrent attendance writes;
- idempotent replay;
- audit immutability;
- import rollback;
- migration row-count and report equivalence.

### Android

- unit tests for use cases, validators, repositories, mappers, and ViewModels;
- Compose tests for loading, empty, success, validation, conflict, forbidden, expired-session, MFA, and network-unavailable states;
- integration tests against a dedicated Supabase test project or branch;
- navigation and role-visibility tests;
- process recreation and configuration-change tests;
- device tests for phone and tablet layouts;
- security tests proving that no business data or credential is logged or stored in plaintext.

### Cross-client parity

Maintain a matrix:

```text
Feature | HTML reference | Web | Windows | Android | Backend contract | Automated test
```

Critical end-to-end scenarios are login/MFA, account role enforcement, class/group access, session creation, full attendance submission, concurrent conflict, administrative correction, report generation, import, export, and session revocation.

## 18. CI/CD and release

- Pin Android, Supabase, JavaScript, .NET, and workflow dependencies; commit lockfiles where supported.
- Build with Java 17 and the supported Android Gradle Plugin/Gradle pair verified at implementation time.
- Replace the current workflow check for embedded HTML with native compile, lint, unit-test, Android-test, dependency, and secret-scan stages.
- Produce signed APK/AAB artifacts from protected CI secrets; debug artifacts are not production releases.
- Enable R8/resource shrinking for release after testing reflection/serialization rules.
- Disallow cleartext network traffic.
- Separate development, test, and production Supabase environments.
- Apply backward-compatible backend changes before client rollout.
- Use `app_config.minimum_client_version` to reject unsafe obsolete clients with an explicit upgrade screen.
- Release native Android under a new major version because the runtime architecture changes from WebView to Compose.

## 19. Implementation sequence

1. Import and checksum the final HTML reference; build the parity matrix.
2. Capture the current schema, policies, functions, and representative production-data invariants.
3. Establish Supabase migrations and a safe test environment.
4. Add audit, revisions, idempotency, private security schema, and common error contracts.
5. Normalize academic data through additive migrations and compatibility views.
6. Implement and test hardened login, MFA, RLS, attendance transaction, reports, and administration APIs.
7. Convert the Android build to Kotlin/Compose and establish core modules/design system.
8. Implement features vertically, beginning with auth, dashboard, sessions, and attendance.
9. Complete remaining parity features and administration.
10. Run cross-client compatibility and security tests.
11. Deploy backend changes, update Web/Windows compatibility code, then release native Android.
12. Remove the Android WebView assets and compatibility code only after production acceptance.

## 20. Acceptance criteria

The design is implemented only when all conditions below are met:

- Android contains no application-screen WebView and all approved screens are native Compose.
- Every final-HTML workflow is represented in the parity matrix and either implemented or explicitly excluded by this design.
- Android performs no business mutation offline and stores no offline business database.
- Web, Windows, and Android read/write the same canonical Supabase records.
- A teacher cannot access another teacher's restricted students, attendance, or administration through UI or direct API calls.
- All administrators and teachers satisfy the approved MFA policy.
- No privileged key or plaintext PIN is present in any client, repository, build artifact, or log.
- Attendance writes are atomic, revision-checked, idempotent, and audited.
- Simultaneous conflicting writes do not overwrite each other.
- Existing production data passes migration reconciliation.
- Supabase security advisors have no unresolved warning relevant to the implemented scope.
- Backend, Android, and cross-client critical-path tests pass in CI.
- The signed release installs and operates on API 24 through the current target API device set defined by the test plan.
