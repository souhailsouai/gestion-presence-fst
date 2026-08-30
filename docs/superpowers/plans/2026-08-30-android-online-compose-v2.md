# Android Online-Only Compose V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the production Android WebView with a native Kotlin/Jetpack Compose application that is online-only, MFA-secured, and functionally equivalent to the approved HTML.

**Architecture:** Android uses a multi-module MVVM/Clean Architecture. Compose screens emit actions to ViewModels, which invoke use cases and repository interfaces. Supabase is the only business-data source; no Room database, outbox, WorkManager synchronization, or persisted offline mutation exists. Realtime notifications invalidate in-memory queries and trigger canonical reloads.

**Tech Stack:** Kotlin 2.x, Android Gradle Plugin 8.x, Jetpack Compose Material 3, Navigation Compose typed routes, Coroutines/Flow, Hilt, Kotlin serialization, Supabase Kotlin 3.8.0, Ktor, DataStore only for non-sensitive preferences, Android Keystore-backed session storage, JUnit, Compose UI tests.

**Spec:** `docs/superpowers/specs/2026-08-30-native-android-supabase-design.md`

## Global Constraints

- Package remains `tn.utm.fst.gestionpresence` for upgrade compatibility.
- `minSdk 24`, `targetSdk 35`, Java/Kotlin target 17.
- No `android.webkit.WebView`, `file:///android_asset`, Room, SQLDelight, Realm, WorkManager, or business-data file cache.
- No service-role or secret key in APK.
- Business controls are disabled without Internet.
- AAL2 is required before main navigation and privileged operations.
- Attendance uses one atomic revision/idempotency RPC.
- The final APK/AAB is signed through protected CI secrets; debug artifacts remain clearly labeled.

---

### Task 1: Create the multi-module project and architecture contract

**Files:**
- Modify: `settings.gradle.kts`, root `build.gradle.kts`, `gradle/libs.versions.toml`.
- Create modules: `app`, `core/common`, `core/model`, `core/network`, `core/security`, `core/designsystem`, `core/testing`, `feature/auth`, `feature/dashboard`, `feature/classes`, `feature/timetable`, `feature/teachers`, `feature/students`, `feature/sessions`, `feature/attendance`, `feature/reports`, `feature/admin`, and `feature/account`.
- Test: `app/src/test/.../ArchitectureContractTest.kt`.

**Interfaces:**
- Features depend only on declared core modules; `app` owns navigation and dependency composition.

- [ ] Write an architecture test that scans all production Kotlin/Gradle files and rejects WebView, Room, WorkManager, SQLite, service-role strings, and direct feature-to-feature dependencies.
- [ ] Confirm the test fails against the previous scaffold.
- [ ] Create version catalog with exact pinned dependency versions and module convention settings.
- [ ] Add all modules and minimal compile-safe source sets.
- [ ] Run `./gradlew test` and confirm architecture test passes.
- [ ] Commit scaffold.

### Task 2: Define domain models, commands, and common errors

**Files:**
- Create models under `core/model/src/main/...` for `Profile`, `UserRole`, `AcademicClass`, `Student`, `TeachingSession`, `AttendanceSheet`, `AttendanceRecord`, `AttendanceStatus`, `AppContract`, `AuditEvent`, and `AppError`.
- Test model validation.

**Interfaces:**
- `AttendanceStatus` wire values are `present`, `absent`, `retard`, `justifie`.
- `SaveAttendanceCommand(sessionId: String, expectedRevision: Long, operationId: String, records: List<AttendanceDraft>, justification: String?)`.

- [ ] Write tests for status serialization, grade boundaries, time ordering, unique student records, and stable error mapping.
- [ ] Implement immutable serializable models and validators.
- [ ] Run focused tests and commit.

### Task 3: Implement secure configuration, connectivity, and session storage

**Files:**
- `core/network`: Supabase client factory, connectivity monitor, API error mapper.
- `core/security`: session store and redacting logger.
- Test: JVM tests plus instrumentation tests for encrypted persistence.

**Interfaces:**
- `ConnectivityMonitor.isOnline: StateFlow<Boolean>`.
- `SessionStore.session: StateFlow<AppSession?>` with `save`, `clear`, and expiry validation.

- [ ] Read Supabase URL and publishable key from generated BuildConfig fields; fail build when missing in release.
- [ ] Use Android Keystore-backed encryption for refresh/session material and never store PIN/TOTP secret.
- [ ] Redact bearer tokens, PIN-like values, and TOTP secrets from logs.
- [ ] Implement network-unavailable mapping without retrying writes.
- [ ] Add tests and commit.

### Task 4: Implement authentication and mandatory MFA

**Files:**
- `feature/auth` data/domain/presentation packages.
- `app` authentication navigation graph.

**Interfaces:**
- `AuthRepository.login(identifier, credential, mode)`.
- `MfaRepository.getAal()`, `enrollTotp()`, `challenge(factorId)`, `verify(factorId, challengeId, code)`.
- UI states: mode selection, credentials, enrollment QR/secret, challenge, locked/rate-limited, success.

- [ ] Write ViewModel tests for teacher/admin login, invalid credentials, enrollment, existing-factor challenge, invalid TOTP, role mismatch, and revoked session.
- [ ] Implement server login exchange and Supabase MFA APIs.
- [ ] Prevent transition to main graph until AAL2.
- [ ] Add secure sign-out and change-account flows.
- [ ] Add Compose tests and commit.

### Task 5: Implement design system and adaptive navigation

**Files:**
- `core/designsystem`: colors, typography, spacing, icons, reusable loading/error/empty/conflict components.
- `app`: typed route definitions and adaptive scaffold.

**Interfaces:**
- Phone bottom navigation: Home, Sessions, Attendance, More.
- Expanded navigation rail/drawer for tablets.

- [ ] Encode FST navy/gold institutional identity with accessible contrast.
- [ ] Add semantic content descriptions and 48dp minimum touch targets.
- [ ] Implement role-aware route guards.
- [ ] Test admin visibility, back navigation, process recreation, and window-size adaptation.
- [ ] Commit design/navigation.

### Task 6: Implement read repositories and core feature screens

**Files:**
- Repositories in `core/network` and each feature's data package.
- Features: dashboard, classes, timetable, teachers, students, sessions.

**Interfaces:**
- All repository reads return typed `Result`/domain errors and expose immutable StateFlow UI states.

- [ ] Implement app-contract/minimum-version check at startup.
- [ ] Implement dashboard counts and recent sessions.
- [ ] Implement class/group, timetable, teacher directory, student list/search/import preview, and session list/create/complete screens.
- [ ] Add loading, empty, retry, forbidden, expired-session, and network-unavailable tests for each feature.
- [ ] Commit features in logical groups.

### Task 7: Implement attendance editing and conflict resolution

**Files:**
- `feature/attendance` repository, use cases, ViewModel, screen, and tests.

**Interfaces:**
- Load uses `get_attendance_sheet`.
- Save uses `save_attendance_sheet` with expected revision and UUID operation ID.

- [ ] Write tests for initial sheet, bulk status changes, comments, grades, validation, stale revision, idempotent timeout replay, admin justification, and canonical reload.
- [ ] Keep drafts in memory only; discard or explicitly confirm before leaving.
- [ ] On conflict, display server revision and changed rows; never overwrite automatically.
- [ ] Disable save immediately when connectivity is lost.
- [ ] Commit implementation.

### Task 8: Implement reports, administration, and account security

**Files:**
- `feature/reports`, `feature/admin`, and `feature/account`.

**Interfaces:**
- Report periods: all, current week, current month.
- Admin commands require AAL2 and recent authentication.

- [ ] Implement report filters, attendance statistics, and CSV/PDF share/export through server-approved data.
- [ ] Implement teacher account management, audit view, global export request, app configuration, and session revocation.
- [ ] Implement MFA factor management and credential-change flows.
- [ ] Escape spreadsheet formula prefixes and use Android Sharesheet/FileProvider.
- [ ] Add role and security tests; commit.

### Task 9: Implement Realtime invalidation

**Files:**
- `core/network` realtime service and feature invalidation bindings.

**Interfaces:**
- Realtime events emit aggregate keys; repositories refetch canonical data.

- [ ] Subscribe after AAL2 and unsubscribe on logout.
- [ ] Debounce duplicate events and reconnect with bounded backoff.
- [ ] Never merge Realtime payload directly into authoritative UI state.
- [ ] Add tests and commit.

### Task 10: Replace legacy APK workflow and produce release artifacts

**Files:**
- Modify `.github/workflows/build-apk.yml`.
- Create `.github/workflows/android-v2.yml`.
- Remove production Java WebView source/assets only after native tests pass.
- Create release verification document.

**Interfaces:**
- Produces debug APK for verification, signed release APK, and signed AAB.

- [ ] Run unit tests, lint, architecture scan, and assemble debug.
- [ ] Run Compose/instrumentation tests on emulator in CI.
- [ ] Verify APK has no WebView/Room/WorkManager dependency or service-role string.
- [ ] Configure signing from GitHub secrets without exposing keystore material.
- [ ] Build and upload APK/AAB plus SHA-256 manifest.
- [ ] Install debug APK on emulator and execute login/network/navigation smoke tests.
- [ ] Switch production workflow from legacy `app` to native modules and archive the old wrapper outside release artifacts.
- [ ] Commit verification report.

## Completion Gate

- Native APK contains no WebView or offline business database.
- All approved screens and role rules have tests.
- MFA reaches and enforces AAL2.
- Attendance conflict/idempotency tests pass against staging.
- CI produces installable APK/AAB with checksums from the release branch.
