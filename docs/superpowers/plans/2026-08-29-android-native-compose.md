# Gestion Présence FST Native Android Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Android WebView wrapper with a genuine Kotlin + Jetpack Compose attendance application supporting offline-first data, Supabase synchronization, native PDF reports, Admin/Teacher workspaces, and an adaptive FST-inspired launcher icon.

**Architecture:** The Android app uses Compose for all UI, Room as the working database, repositories as the only data access boundary, an outbox-driven synchronization engine scheduled by WorkManager, and Supabase as the authoritative remote backend. Authentication is handled separately from operational data; local UI remains functional offline from Room, while server-authoritative administrative operations are marked pending until backend confirmation.

**Tech Stack:** Kotlin, Android Gradle Plugin, Jetpack Compose Material 3, Navigation Compose, Room, WorkManager, Hilt, DataStore, Kotlin coroutines/Flow, Supabase Kotlin client, Android PdfDocument, Android Sharesheet/FileProvider, JUnit, AndroidX Test, Compose UI Test.

**Spec:** `docs/superpowers/specs/2026-08-29-android-native-compose-design.md`

## Global Constraints

- Academic year is exactly `2026/2027`.
- Academic classes are `MPI1`, `MPI2`, `MPI3`, `MPI4`, `MPI5`, and `PC1`.
- Each class supports 3 or 4 TP groups.
- Attendance states are exactly `present`, `absent`, `late`, `justified`.
- Grades are optional and constrained to the inclusive range `0.0..20.0`.
- The application interface MUST NOT use WebView.
- Room is the UI-facing working database; the UI must not depend directly on the network.
- Every synchronizable entity carries a stable UUID, revision/base revision, updated timestamp, actor id, sync state, and tombstone/deletion state where applicable.
- Conflicts must never silently overwrite same-record changes.
- Supabase Auth is authoritative for identity; no service-role secret may be bundled in the APK.
- Reports must be generated locally with Android `PdfDocument` without Internet access.
- The Android launcher must use an adaptive icon with separate foreground/background resources.
- Browser/Windows HTML applications remain unchanged by this Android rewrite.

---

## File Structure

`app-native/` becomes the new Android application module while the current legacy `app/` module stays intact until native verification is green. After final acceptance, the build workflow switches APK production to `app-native`.

- `app-native/build.gradle.kts` — Android/Compose dependencies and build configuration.
- `app-native/src/main/AndroidManifest.xml` — launcher activity, permissions, FileProvider, WorkManager-compatible app setup.
- `app-native/src/main/java/tn/utm/fst/gestionpresence/nativeapp/GestionPresenceApplication.kt` — Hilt application.
- `app-native/src/main/java/.../MainActivity.kt` — Compose host only; no WebView.
- `app-native/src/main/java/.../core/model/` — domain enums/value objects.
- `app-native/src/main/java/.../data/local/` — Room entities, DAOs, database, converters.
- `app-native/src/main/java/.../data/remote/` — Supabase DTO/client boundaries.
- `app-native/src/main/java/.../data/repository/` — repository interfaces and implementations.
- `app-native/src/main/java/.../sync/` — outbox, conflict decision logic, worker, scheduler.
- `app-native/src/main/java/.../auth/` — session and role/workspace handling.
- `app-native/src/main/java/.../ui/` — Compose theme, navigation, screens, reusable components.
- `app-native/src/main/java/.../report/` — PDF data model and generator.
- `app-native/src/main/res/mipmap-anydpi-v26/` + `drawable/` — adaptive icon resources.
- `app-native/src/test/` — JVM unit tests.
- `app-native/src/androidTest/` — Room/Compose/integration tests.
- `.github/workflows/build-native-apk.yml` — dedicated native APK CI until migration is complete.

---

### Task 1: Native Module Scaffold and No-WebView Contract

**Files:**
- Create: `app-native/build.gradle.kts`
- Create: `app-native/proguard-rules.pro`
- Create: `app-native/src/main/AndroidManifest.xml`
- Create: `app-native/src/main/java/tn/utm/fst/gestionpresence/nativeapp/GestionPresenceApplication.kt`
- Create: `app-native/src/main/java/tn/utm/fst/gestionpresence/nativeapp/MainActivity.kt`
- Create: `app-native/src/main/java/tn/utm/fst/gestionpresence/nativeapp/ui/AppRoot.kt`
- Create: `app-native/src/test/java/tn/utm/fst/gestionpresence/nativeapp/ArchitectureContractTest.kt`
- Modify: `settings.gradle`

**Interfaces:**
- Produces: `@HiltAndroidApp class GestionPresenceApplication : Application`
- Produces: `MainActivity : ComponentActivity`
- Produces: `@Composable fun AppRoot()`

- [ ] **Step 1: Write the failing architecture test**

```kotlin
class ArchitectureContractTest {
    @Test
    fun `native app source does not reference WebView`() {
        val root = java.io.File("src/main/java")
        val combined = root.walkTopDown()
            .filter { it.isFile && it.extension == "kt" }
            .joinToString("\n") { it.readText() }
        assertFalse(combined.contains("android.webkit.WebView"))
        assertFalse(combined.contains("file:///android_asset"))
    }
}
```

- [ ] **Step 2: Run the test before the module exists**

Run: `./gradlew :app-native:testDebugUnitTest`

Expected: FAIL because `app-native` is not yet configured.

- [ ] **Step 3: Create the Compose-only module**

Configure namespace `tn.utm.fst.gestionpresence.nativeapp`, `minSdk 26`, current stable compile/target SDK available in CI, Compose Material 3, Hilt, Room, WorkManager, Navigation Compose, DataStore and Supabase client dependencies. `MainActivity` must only call `setContent { AppRoot() }`.

- [ ] **Step 4: Add the module to settings**

Add:

```gradle
include ':app-native'
```

- [ ] **Step 5: Run the native unit test**

Run: `./gradlew :app-native:testDebugUnitTest`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add settings.gradle app-native
git commit -m "feat(android): scaffold native Compose application"
```

---

### Task 2: Domain Model and Validation Rules

**Files:**
- Create: `app-native/src/main/java/.../core/model/AcademicClass.kt`
- Create: `app-native/src/main/java/.../core/model/AttendanceStatus.kt`
- Create: `app-native/src/main/java/.../core/model/Role.kt`
- Create: `app-native/src/main/java/.../core/model/SyncState.kt`
- Create: `app-native/src/main/java/.../core/model/Grade.kt`
- Create: `app-native/src/test/java/.../core/model/DomainValidationTest.kt`

**Interfaces:**
- Produces: `enum class AcademicClass { MPI1, MPI2, MPI3, MPI4, MPI5, PC1 }`
- Produces: `enum class AttendanceStatus { PRESENT, ABSENT, LATE, JUSTIFIED }`
- Produces: `enum class UserRole { ADMIN, TEACHER }`
- Produces: `enum class WorkspaceMode { ADMIN, TEACHER }`
- Produces: `enum class SyncState { SYNCED, OFFLINE, PENDING, SYNCING, CONFLICT, ERROR }`
- Produces: `@JvmInline value class Grade private constructor(val value: Double)` with `Grade.of(value: Double): Grade`

- [ ] **Step 1: Write validation tests**

```kotlin
@Test fun `grade accepts zero and twenty`() {
    assertEquals(0.0, Grade.of(0.0).value)
    assertEquals(20.0, Grade.of(20.0).value)
}

@Test fun `grade rejects values outside range`() {
    assertFailsWith<IllegalArgumentException> { Grade.of(-0.1) }
    assertFailsWith<IllegalArgumentException> { Grade.of(20.1) }
}

@Test fun `academic classes are fixed`() {
    assertEquals(listOf("MPI1","MPI2","MPI3","MPI4","MPI5","PC1"), AcademicClass.entries.map { it.name })
}
```

- [ ] **Step 2: Run tests and verify failure**

Run: `./gradlew :app-native:testDebugUnitTest --tests '*DomainValidationTest'`

Expected: FAIL because types do not exist.

- [ ] **Step 3: Implement the domain types**

`Grade.of` must call `require(value in 0.0..20.0)`.

- [ ] **Step 4: Run tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app-native/src/main/java app-native/src/test
git commit -m "feat(android): add attendance domain model"
```

---

### Task 3: Room Offline Database

**Files:**
- Create: `app-native/src/main/java/.../data/local/entity/UserEntity.kt`
- Create: `.../ClassEntity.kt`
- Create: `.../GroupEntity.kt`
- Create: `.../StudentEntity.kt`
- Create: `.../SessionEntity.kt`
- Create: `.../AttendanceEntity.kt`
- Create: `.../GradeEntity.kt`
- Create: `.../OutboxEntity.kt`
- Create: `.../ConflictEntity.kt`
- Create: `.../AuditEntity.kt`
- Create: `.../dao/*.kt`
- Create: `.../GestionPresenceDatabase.kt`
- Create: `app-native/src/androidTest/java/.../data/local/RoomDatabaseTest.kt`

**Interfaces:**
- All synchronizable entities expose `id: String`, `revision: Long`, `updatedAtEpochMs: Long`, `actorId: String`, `syncState: SyncState`, `deleted: Boolean`.
- Produces DAO Flows used by repositories.
- Produces `GestionPresenceDatabase` with explicit entities and version `1`.

- [ ] **Step 1: Write Room integration tests**

Test a student insert/read, attendance upsert, optional grade, and transaction that creates a local mutation plus outbox record.

- [ ] **Step 2: Run connected tests**

Run: `./gradlew :app-native:connectedDebugAndroidTest -Pandroid.testInstrumentationRunnerArguments.class=tn.utm.fst.gestionpresence.nativeapp.data.local.RoomDatabaseTest`

Expected: FAIL because Room schema does not exist.

- [ ] **Step 3: Implement entities and DAOs**

Use UUID strings as primary keys. Use unique constraints needed to prevent duplicate attendance for `(sessionId, studentId)` and duplicate grade for `(sessionId, studentId)`.

- [ ] **Step 4: Implement database transaction helper**

Create a repository-facing transaction that writes the entity and corresponding `OutboxEntity` atomically.

- [ ] **Step 5: Run Room tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app-native/src/main/java app-native/src/androidTest
git commit -m "feat(android): add offline Room database"
```

---

### Task 4: Authentication, Workspace Mode, and Secure Session Boundary

**Files:**
- Create: `app-native/src/main/java/.../auth/AuthRepository.kt`
- Create: `.../SupabaseAuthRepository.kt`
- Create: `.../SessionStore.kt`
- Create: `.../WorkspaceController.kt`
- Create: `app-native/src/test/java/.../auth/WorkspaceControllerTest.kt`

**Interfaces:**
- `suspend fun signIn(identifier: String, credential: String): AuthenticatedUser`
- `suspend fun signOut()`
- `val session: Flow<AuthSession?>`
- `fun allowedWorkspaceModes(role: UserRole): Set<WorkspaceMode>`
- Admin role returns both ADMIN and TEACHER; Teacher returns TEACHER only.

- [ ] **Step 1: Write workspace-mode tests**

```kotlin
@Test fun `admin may use admin and teacher workspaces`() {
    assertEquals(setOf(WorkspaceMode.ADMIN, WorkspaceMode.TEACHER), controller.allowedWorkspaceModes(UserRole.ADMIN))
}

@Test fun `teacher cannot enter admin workspace`() {
    assertEquals(setOf(WorkspaceMode.TEACHER), controller.allowedWorkspaceModes(UserRole.TEACHER))
}
```

- [ ] **Step 2: Run tests and verify failure**

- [ ] **Step 3: Implement workspace policy and DataStore persistence**

Persist only non-sensitive workspace preference in DataStore. Supabase session/token handling must remain inside the Supabase/auth client boundary; do not serialize secrets into plain preferences.

- [ ] **Step 4: Implement identifier adapter**

Support the backend's existing admin email/username and teacher username flow through repository methods; do not hardcode credentials or PINs in source.

- [ ] **Step 5: Run tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app-native/src/main/java app-native/src/test
git commit -m "feat(android): add authentication and workspace policy"
```

---

### Task 5: Outbox Synchronization and Conflict Detection

**Files:**
- Create: `app-native/src/main/java/.../sync/Mutation.kt`
- Create: `.../ConflictDecision.kt`
- Create: `.../ConflictResolver.kt`
- Create: `.../SyncRepository.kt`
- Create: `.../SyncWorker.kt`
- Create: `.../SyncScheduler.kt`
- Create: `app-native/src/test/java/.../sync/ConflictResolverTest.kt`
- Create: `app-native/src/test/java/.../sync/OutboxStateMachineTest.kt`

**Interfaces:**
- `fun decide(baseRevision: Long, remoteRevision: Long, localChanged: Boolean, remoteChanged: Boolean): ConflictDecision`
- Decisions: `APPLY_LOCAL`, `APPLY_REMOTE`, `MERGE_SAFE`, `REQUIRE_USER_RESOLUTION`.
- `SyncWorker` sends pending mutations only when network constraint is met.

- [ ] **Step 1: Write conflict tests**

```kotlin
@Test fun `same revision local-only edit may upload`() {
    assertEquals(ConflictDecision.APPLY_LOCAL, resolver.decide(5,5,true,false))
}

@Test fun `both sides changed from same base requires resolution`() {
    assertEquals(ConflictDecision.REQUIRE_USER_RESOLUTION, resolver.decide(5,6,true,true))
}
```

- [ ] **Step 2: Run and verify failure**

- [ ] **Step 3: Implement deterministic conflict resolver**

Do not use timestamps alone to resolve same-record conflicts.

- [ ] **Step 4: Implement outbox state machine**

Allowed transitions: `PENDING -> SYNCING -> SYNCED`; on retryable network error `SYNCING -> PENDING`; on data conflict `SYNCING -> CONFLICT`; on non-retryable validation error `SYNCING -> ERROR`.

- [ ] **Step 5: Implement WorkManager scheduling**

Use unique work name `presence-sync`, network connected constraint, exponential backoff for retryable failures.

- [ ] **Step 6: Run unit tests**

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app-native/src/main/java app-native/src/test
git commit -m "feat(android): add offline outbox synchronization"
```

---

### Task 6: Repository Layer for Classes, Students, Sessions, Attendance, and Grades

**Files:**
- Create: `app-native/src/main/java/.../data/repository/ClassRepository.kt`
- Create: `.../StudentRepository.kt`
- Create: `.../SessionRepository.kt`
- Create: `.../AttendanceRepository.kt`
- Create: `.../GradeRepository.kt`
- Create implementations under same package.
- Create: `app-native/src/androidTest/java/.../data/repository/OfflineRepositoryTest.kt`

**Interfaces:**
- Reads return `Flow<List<...>>` from Room.
- Writes are local-first and atomically enqueue outbox mutations.
- `suspend fun recordAttendance(sessionId: String, studentId: String, status: AttendanceStatus, observation: String?)`
- `suspend fun setGrade(sessionId: String, studentId: String, grade: Grade?, observation: String?)`

- [ ] **Step 1: Write offline repository test**

Disable/omit network client and prove create session, attendance and grade are immediately queryable from Room and each write creates a pending outbox mutation.

- [ ] **Step 2: Run test and verify failure**

- [ ] **Step 3: Implement local-first repositories**

Repositories must never block UI state waiting for Supabase before persisting a valid local operational edit.

- [ ] **Step 4: Run tests**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app-native/src/main/java app-native/src/androidTest
git commit -m "feat(android): add offline-first repositories"
```

---

### Task 7: Material 3 Theme, Adaptive Layout, and Launcher Icon

**Files:**
- Create: `app-native/src/main/java/.../ui/theme/Color.kt`
- Create: `.../Theme.kt`
- Create: `.../Typography.kt`
- Create: `app-native/src/main/res/drawable/ic_launcher_background.xml`
- Create: `app-native/src/main/res/drawable/ic_launcher_foreground.xml`
- Create: `app-native/src/main/res/mipmap-anydpi-v26/ic_launcher.xml`
- Create: `app-native/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml`
- Create: `app-native/src/main/res/values/colors.xml`
- Create: `app-native/src/test/java/.../IconResourceContractTest.kt`

**Interfaces:**
- Produces `GestionPresenceTheme`.
- Icon foreground is a simplified FST-inspired academic mark, not a raster screenshot of the institutional logo.

- [ ] **Step 1: Write resource contract test**

Assert manifest references `@mipmap/ic_launcher` and adaptive XML resources reference distinct foreground/background layers.

- [ ] **Step 2: Run and verify failure**

- [ ] **Step 3: Implement navy/gold/white Material 3 theme**

Use responsive Compose layouts based on available width, not hardcoded S24 Ultra pixel dimensions.

- [ ] **Step 4: Implement adaptive launcher icon**

Create vector foreground with safe-zone margins suitable for Android adaptive masking; background is institutional navy.

- [ ] **Step 5: Run tests and build resource merge**

Run: `./gradlew :app-native:processDebugResources :app-native:testDebugUnitTest`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app-native/src/main
git commit -m "feat(android): add adaptive FST-inspired identity"
```

---

### Task 8: Native Navigation, Splash, Login, and Home

**Files:**
- Create: `app-native/src/main/java/.../ui/navigation/AppDestination.kt`
- Create: `.../AppNavHost.kt`
- Create: `.../ui/splash/SplashScreen.kt`
- Create: `.../ui/login/LoginScreen.kt`
- Create: `.../ui/login/LoginViewModel.kt`
- Create: `.../ui/home/HomeScreen.kt`
- Create: `.../ui/home/HomeViewModel.kt`
- Create: `app-native/src/androidTest/java/.../ui/LoginUiTest.kt`

**Interfaces:**
- Destinations include Splash, Login, Home, Classes, Students, Sessions, Attendance, Grades, Reports, Administration, Settings.
- Login includes workspace choice when authenticated role permits multiple modes.

- [ ] **Step 1: Write Compose login tests**

Verify native fields for identifier/credential, role/workspace selector behavior, error text, and absence of WebView semantics.

- [ ] **Step 2: Run tests and verify failure**

- [ ] **Step 3: Implement splash and login Compose screens**

Credential field uses password visual transformation. No account-registration UI is present.

- [ ] **Step 4: Implement adaptive Home screen**

Phone uses Material 3 bottom navigation for primary areas. Wider layouts may use navigation rail.

- [ ] **Step 5: Run UI tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app-native/src/main/java app-native/src/androidTest
git commit -m "feat(android): add native authentication navigation"
```

---

### Task 9: Classes, Groups, Students, and Session Management Screens

**Files:**
- Create: `app-native/src/main/java/.../ui/classes/*`
- Create: `.../ui/students/*`
- Create: `.../ui/sessions/*`
- Create: `app-native/src/androidTest/java/.../ui/AcademicManagementUiTest.kt`

**Interfaces:**
- Class selector is limited to six `AcademicClass` values.
- Group count accepts only `3` or `4` per class.
- Session model requires class, group, date/time, and module/title.

- [ ] **Step 1: Write UI/domain tests for class/group restrictions**

- [ ] **Step 2: Run and verify failure**

- [ ] **Step 3: Implement class/group screens and forms**

- [ ] **Step 4: Implement student CRUD and session CRUD using repositories**

All successful edits update Room immediately and expose pending sync state when offline.

- [ ] **Step 5: Run UI tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app-native/src/main/java app-native/src/androidTest
git commit -m "feat(android): add academic management screens"
```

---

### Task 10: Attendance and Grades Native Workflows

**Files:**
- Create: `app-native/src/main/java/.../ui/attendance/AttendanceScreen.kt`
- Create: `.../AttendanceViewModel.kt`
- Create: `.../ui/grades/GradesScreen.kt`
- Create: `.../GradesViewModel.kt`
- Create: `app-native/src/androidTest/java/.../ui/AttendanceGradesUiTest.kt`

**Interfaces:**
- Attendance supports PRESENT, ABSENT, LATE, JUSTIFIED and optional observation.
- Grade is optional; non-null grade must be `0..20`.
- Saving operates fully offline against Room.

- [ ] **Step 1: Write Compose UI tests**

Test marking multiple students, changing status, entering optional grade, rejecting `21`, and saving while sync state is offline.

- [ ] **Step 2: Run and verify failure**

- [ ] **Step 3: Implement attendance list optimized for rapid TP entry**

Use large touch targets, persistent student identity, and no horizontally scrolling desktop table.

- [ ] **Step 4: Implement grade editing**

Grade field remains optional and can be added after the session.

- [ ] **Step 5: Run UI tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app-native/src/main/java app-native/src/androidTest
git commit -m "feat(android): add native attendance and grades"
```

---

### Task 11: Native Offline PDF Report Generation

**Files:**
- Create: `app-native/src/main/java/.../report/SessionReport.kt`
- Create: `.../SessionReportBuilder.kt`
- Create: `.../PdfReportGenerator.kt`
- Create: `.../ReportShareController.kt`
- Create: `app-native/src/test/java/.../report/SessionReportBuilderTest.kt`
- Create: `app-native/src/androidTest/java/.../report/PdfReportGeneratorTest.kt`
- Modify: `app-native/src/main/AndroidManifest.xml`
- Create: `app-native/src/main/res/xml/file_paths.xml`

**Interfaces:**
- `suspend fun build(sessionId: String): SessionReport`
- `fun generate(report: SessionReport, output: OutputStream)`
- Report contains institution/year, teacher, class/group, module, date/time, students, attendance, optional grade, observations, counts and percentages.

- [ ] **Step 1: Write report-model unit test**

Assert statistics are calculated from attendance states and absent/late/justified counts remain distinct.

- [ ] **Step 2: Write PDF instrumentation test**

Generate into a temporary file and assert first bytes are `%PDF` and file size is greater than 1 KB.

- [ ] **Step 3: Run tests and verify failure**

- [ ] **Step 4: Implement `PdfDocument` generator**

Paginate student rows; never clip a row at page boundary. Use native canvas text/table drawing.

- [ ] **Step 5: Add save/share/print integration**

Use FileProvider and Sharesheet. Do not require network connectivity.

- [ ] **Step 6: Run PDF tests**

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app-native/src/main app-native/src/test app-native/src/androidTest
git commit -m "feat(android): add offline native PDF reports"
```

---

### Task 12: Administration, Sync Status, Conflict Resolution, and Audit UI

**Files:**
- Create: `app-native/src/main/java/.../ui/admin/*`
- Create: `.../ui/sync/*`
- Create: `.../ui/audit/*`
- Create: `app-native/src/androidTest/java/.../ui/AdminSyncUiTest.kt`

**Interfaces:**
- Admin screens are reachable only when current role is ADMIN and workspace mode is ADMIN.
- Sync UI exposes SYNCED, OFFLINE, PENDING, SYNCING, CONFLICT, ERROR.
- Conflict screen lets user choose local or remote version explicitly; resolution writes an audit record.

- [ ] **Step 1: Write authorization UI tests**

Teacher workspace must not expose Administration destination. Admin teacher-mode also hides admin-only screens until switching workspace.

- [ ] **Step 2: Run and verify failure**

- [ ] **Step 3: Implement admin management screens**

Teacher account creation/modification that needs privileged backend execution must show `pending server confirmation` when queued offline.

- [ ] **Step 4: Implement sync/conflict/audit screens**

- [ ] **Step 5: Run UI tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app-native/src/main/java app-native/src/androidTest
git commit -m "feat(android): add administration and sync controls"
```

---

### Task 13: Offline/Reconnect End-to-End Integration

**Files:**
- Create: `app-native/src/androidTest/java/.../integration/OfflineReconnectTest.kt`
- Create: `app-native/src/androidTest/java/.../integration/ConflictIntegrationTest.kt`
- Add fake remote implementation under `app-native/src/androidTest/java/.../fake/FakeRemoteDataSource.kt`

**Interfaces:**
- Fake remote exposes controlled remote revisions and network availability.

- [ ] **Step 1: Write offline/reconnect test**

Scenario: authenticated cached user -> network unavailable -> create session -> record attendance -> assign grade -> generate report model -> restore network -> run sync -> verify outbox drains and local revisions update.

- [ ] **Step 2: Write conflict integration test**

Scenario: local edit based on revision 4 while fake remote advances to 5 on same record -> sync -> conflict retained -> explicit resolution -> audit record -> next sync succeeds.

- [ ] **Step 3: Run tests and verify failure if integration gaps remain**

- [ ] **Step 4: Make minimal integration corrections**

Do not weaken conflict rules to make tests pass.

- [ ] **Step 5: Run tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app-native/src/androidTest app-native/src/main
git commit -m "test(android): verify offline reconnect and conflicts"
```

---

### Task 14: Native APK CI, Release Gate, and Legacy Wrapper Cutover

**Files:**
- Create: `.github/workflows/build-native-apk.yml`
- Create: `scripts/verify_native_android.py`
- Modify: `.github/workflows/build-apk.yml` only after native gate passes.
- Test: `tests/test_native_android_contract.py`

**Interfaces:**
- Verification rejects `android.webkit.WebView`, `file:///android_asset`, missing adaptive icon, or missing native PDF generator in `app-native`.
- CI artifact name: `Gestion-Presence-FST-Android-Native`.

- [ ] **Step 1: Write failing repository contract test**

```python
from pathlib import Path

root = Path('app-native')
text = '\n'.join(p.read_text(encoding='utf-8', errors='ignore') for p in root.rglob('*') if p.suffix in {'.kt','.xml'})
assert 'android.webkit.WebView' not in text
assert 'file:///android_asset' not in text
assert 'PdfDocument' in text
assert (root/'src/main/res/mipmap-anydpi-v26/ic_launcher.xml').exists()
```

- [ ] **Step 2: Run contract test before workflow exists**

Run: `python -m pytest tests/test_native_android_contract.py -q`

Expected: code contract may pass, but CI workflow contract assertion fails until workflow is added.

- [ ] **Step 3: Implement native APK workflow**

Workflow must run unit tests, lint, assemble debug/release candidate, and upload APK only after tests pass.

- [ ] **Step 4: Run full verification locally/CI**

Commands:

```bash
./gradlew :app-native:testDebugUnitTest
./gradlew :app-native:lintDebug
./gradlew :app-native:assembleDebug
python -m pytest tests/test_native_android_contract.py -q
```

Expected: all PASS and APK produced under `app-native/build/outputs/apk/debug/`.

- [ ] **Step 5: Switch production APK workflow only after green native artifact**

The legacy `app/` WebView module remains in repository for rollback until user confirms the native APK on device.

- [ ] **Step 6: Commit**

```bash
git add .github workflows scripts tests app-native
git commit -m "build(android): publish verified native APK"
```

---

## Final Verification Checklist

- [ ] `grep -R "android.webkit.WebView\|file:///android_asset" app-native/src/main` returns no matches.
- [ ] Unit tests pass with zero failures.
- [ ] Room/instrumentation tests pass.
- [ ] Compose login/attendance/grade UI tests pass.
- [ ] Offline/reconnect test passes.
- [ ] Conflict test proves no silent overwrite.
- [ ] PDF test creates a non-empty `%PDF` file offline.
- [ ] Adaptive icon resources are present and manifest references them.
- [ ] APK builds successfully from `app-native`.
- [ ] Existing browser/Windows HTML build remains untouched.
- [ ] Legacy Android wrapper is not removed until device validation of native APK.
