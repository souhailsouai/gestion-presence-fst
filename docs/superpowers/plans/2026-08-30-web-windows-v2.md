# Web and Windows V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a secure Web application and native Windows application with functional parity to the approved HTML and one shared Supabase V2 contract.

**Architecture:** The approved HTML remains the visual and functional reference. The Web release is generated deterministically from that reference plus versioned external JavaScript/CSS modules. Windows uses the existing native .NET 8 WPF implementation and its own MVVM/service layer; it does not render the application through WebView2. Both clients call the same Supabase RPCs, enforce MFA, and reload canonical data after Realtime notifications.

**Tech Stack:** HTML5/CSS/JavaScript, Supabase JS pinned version, Content Security Policy, Node.js tests, .NET 8 WPF, C#, HttpClient, CommunityToolkit.Mvvm where already used, xUnit, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-30-native-android-supabase-design.md`

## Global Constraints

- Reference file and its SHA-256 never change during this release.
- No service-role or secret key in Web or Windows.
- Web and Windows are online-only for V2 mutations.
- Authentication UI remains username plus six-digit PIN/password and adds TOTP enrollment/challenge.
- Business screens require AAL2.
- No silent last-write-wins; attendance uses expected revision and operation UUID.
- Realtime invalidates queries; clients fetch canonical rows.
- Exports use UTF-8 and escape spreadsheet formula prefixes.
- Windows target is Windows 10/11 x64 and .NET 8.

---

### Task 1: Import the verified native Windows baseline

**Files:**
- Import from branch `feature/native-windows-app`: `.github/workflows/build-windows.yml`, `windows/GestionPresenceFST/**`, and `windows/GestionPresenceFST.Tests/**`.
- Preserve: approved cross-platform spec and reference files from the release branch.

**Interfaces:**
- Produces a compilable native WPF solution with no HTML, JavaScript, browser, WebView2, localhost, or 127.0.0.1 runtime dependency.

- [ ] Create a merge/import commit with both branch histories recorded.
- [ ] Run architecture tests that scan project references and source text for prohibited WebView/browser dependencies.
- [ ] Run `dotnet test` and `dotnet publish -c Release -r win-x64 --self-contained true` in GitHub Actions.
- [ ] Retain only source-based native Windows assets; remove obsolete encoded source reconstruction files from the release branch.
- [ ] Commit the cleaned baseline.

### Task 2: Build deterministic Web release files

**Files:**
- Create: `web/index.html`
- Create: `web/assets/app-v2.js`
- Create: `web/assets/app-v2.css`
- Create: `web/assets/supabase-client.js`
- Create: `scripts/build_web_release.py`
- Test: `tests/web/reference-build.test.cjs`

**Interfaces:**
- `build_web_release.py` consumes the frozen reference and injects external assets plus security metadata without changing reference semantics.
- Produces `dist/web/Gestion-Presence-FST-Web-2026-2027.html` and `dist/web/site/**`.

- [ ] Write a test that verifies required tabs/actions and the frozen reference digest.
- [ ] Implement deterministic build with UTF-8 and stable ordering.
- [ ] Add CSP with no `unsafe-eval`; minimize inline code by moving new behavior into external modules.
- [ ] Generate both hosted multi-file site and portable single-file release.
- [ ] Run the build twice and compare SHA-256 outputs.
- [ ] Commit source, tests, and generated release metadata.

### Task 3: Add the common V2 API client and error mapping

**Files:**
- Create: `web/api/client.js`
- Create: `web/api/errors.js`
- Create: `windows/GestionPresenceFST/Infrastructure/Supabase/SupabaseClient.cs`
- Create: `windows/GestionPresenceFST/Infrastructure/Supabase/AppError.cs`
- Test: `tests/web/api-client.test.cjs`
- Test: `windows/GestionPresenceFST.Tests/Infrastructure/AppErrorTests.cs`

**Interfaces:**
- Web: `api.getContract()`, `api.getAttendanceSheet(sessionId)`, `api.saveAttendanceSheet(command)`, and query methods for profiles/classes/students/sessions/reports.
- Windows: `ISupabaseGateway` with matching typed methods.

- [ ] Implement exact stable error-code mapping.
- [ ] Generate a correlation UUID per request and preserve server correlation IDs.
- [ ] Retry reads with bounded exponential backoff; never retry a non-idempotent write without the same operation UUID.
- [ ] Reject all business calls when offline.
- [ ] Add contract tests with mocked 401, 403, 409, 429, and 503 responses.
- [ ] Commit clients and tests.

### Task 4: Implement login and MFA in Web and Windows

**Files:**
- Create: `web/features/auth/auth-controller.js`
- Create: `web/features/auth/mfa-controller.js`
- Create: `windows/GestionPresenceFST/Features/Auth/LoginViewModel.cs`
- Create: `windows/GestionPresenceFST/Features/Auth/MfaViewModel.cs`
- Modify native login/security windows and Web authentication forms.

**Interfaces:**
- Login obtains AAL1 session from `admin-pin-login` or teacher sign-in, checks current/next AAL, then enrolls or challenges TOTP to reach AAL2.
- Session state exposes authenticated profile, role, AAL, expiry, and revocation state.

- [ ] Add unit tests for new enrollment, existing-factor challenge, invalid code, revoked session, and role mismatch.
- [ ] Ensure QR/secret is displayed only during enrollment and never logged.
- [ ] Require AAL2 before main navigation and before every privileged admin command.
- [ ] Store Windows refresh token using Windows Data Protection API; use browser session storage only for Web session state.
- [ ] Implement secure sign-out and local token deletion.
- [ ] Commit authentication changes and tests.

### Task 5: Implement parity workflows through V2 repositories

**Files:**
- Web modules under `web/features/{dashboard,classes,timetable,teachers,students,sessions,attendance,reports,admin,account}/`.
- Windows feature folders under `windows/GestionPresenceFST/Features/**`.
- Update `docs/parity/parity-matrix.csv`.

**Interfaces:**
- Every approved HTML workflow maps to a route/view, use case, backend operation, permission, and test.

- [ ] Implement dashboard counts and recent sessions.
- [ ] Implement class/group, timetable, teacher directory, and student CRUD/import with validation preview.
- [ ] Implement session creation and completion state.
- [ ] Implement attendance editing with revision, operation UUID, explicit conflict UI, comment, grade, and administrative justification.
- [ ] Implement reports for all time, current week, and current month.
- [ ] Implement authorized admin account management, exports, audit view, and configuration view.
- [ ] Add tests for loading, empty, success, validation, forbidden, expired session, MFA required, network unavailable, and version conflict states.
- [ ] Mark parity rows complete only when both Web and Windows tests exist.
- [ ] Commit feature groups in independently reviewable commits.

### Task 6: Realtime invalidation and canonical reload

**Files:**
- Create: `web/api/realtime.js`
- Create: `windows/GestionPresenceFST/Infrastructure/Supabase/RealtimeInvalidator.cs`
- Test corresponding modules.

**Interfaces:**
- Emits typed invalidation events for profile, class, student, session, attendance sheet, attendance record, audit, and app-config changes.

- [ ] Subscribe only after AAL2 authentication.
- [ ] Scope channels to authorized data where filters are available.
- [ ] On event, invalidate and refetch; do not merge payload directly into canonical state.
- [ ] Debounce repeated notifications for the same aggregate.
- [ ] Unsubscribe on sign-out or token revocation.
- [ ] Add tests for deduplication and canonical reload.
- [ ] Commit implementation.

### Task 7: Harden import, export, and Web security

**Files:**
- Create: `web/security/csv.js`
- Create: `windows/GestionPresenceFST/Security/SpreadsheetEscaper.cs`
- Modify deployment headers and export services.

**Interfaces:**
- `escapeSpreadsheetCell(value)` prefixes formula-leading cells.
- Import parser returns preview rows and row-level validation errors before commit.

- [ ] Test formula injection values beginning with `=`, `+`, `-`, `@`, tab, and carriage return.
- [ ] Enforce file-size, type, encoding, required-column, and duplicate checks.
- [ ] Set CSP, Referrer-Policy, Permissions-Policy, X-Content-Type-Options, and frame restrictions for hosted Web.
- [ ] Remove sensitive logging and redact tokens/PIN/MFA values from exception reports.
- [ ] Run browser static tests and Windows security tests.
- [ ] Commit hardening changes.

### Task 8: Build final Web and Windows artifacts

**Files:**
- Create: `.github/workflows/build-web-windows-v2.yml`
- Create: `docs/releases/2026-08-30-web-windows-v2.md`

**Interfaces:**
- Produces artifacts `Gestion-Presence-FST-Web-2026-2027`, `Gestion-Presence-FST-Windows-x64`, and `Gestion-Presence-FST-Setup-x64`.

- [ ] Run all Web and Windows unit/integration tests.
- [ ] Verify forbidden dependency scan.
- [ ] Build Web site/single-file release.
- [ ] Publish self-contained Windows x64 application and installer.
- [ ] Generate SHA-256 manifest and SBOM/dependency list.
- [ ] Download and inspect artifacts; record exact workflow run and commit SHA.
- [ ] Commit verification report.

## Completion Gate

- All approved workflows have Web and Windows parity evidence.
- Both clients require AAL2 and use the V2 attendance RPC.
- Windows is genuinely native and contains no WebView/browser runtime.
- Web passes CSP/static security tests.
- Final artifacts build successfully from the release branch and include checksums.
