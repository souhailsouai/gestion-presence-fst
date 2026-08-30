# Native Windows and Cross-Platform Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the WebView2 Windows wrapper with a fully native .NET 8 WPF/MVVM client and release all three clients against the same simple-auth Supabase backend.

**Architecture:** The official Windows executable uses only XAML/C# native controls. ViewModels depend on repository interfaces; typed HTTP services communicate with Supabase Auth, REST, RPCs, and Edge Functions. No HTML, WebView2, JavaScript bridge, or embedded Web client is part of the official Windows build.

**Tech Stack:** .NET 8, WPF, XAML, C#, MVVM, HttpClient, System.Text.Json, Windows Credential Manager/DPAPI, xUnit, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-30-simple-auth-native-windows-design.md`

## Global Constraints

- Windows official project is WPF/.NET 8 and 100% native for business UI.
- No `Microsoft.Web.WebView2`, `<WebView2>`, embedded `web/index.html`, HTML renderer, or JavaScript bridge.
- Authentication modes are PIN and password only.
- Backend remains authoritative for roles and permissions.
- Attendance saves use `save_attendance_sheet(session_id, expected_revision, operation_id, records, justification)` and surface `VERSION_CONFLICT`.

---

### Task 1: Establish native Windows solution boundary

**Files:**
- Create: `windows/GestionPresenceFST.Native/GestionPresenceFST.Native.csproj`
- Create: `windows/GestionPresenceFST.Native.Tests/GestionPresenceFST.Native.Tests.csproj`
- Create: `windows/GestionPresenceFST.Native/App.xaml`
- Create: `windows/GestionPresenceFST.Native/App.xaml.cs`
- Create: `tests/test_windows_native_contract.py`

**Interfaces:**
- Produces the official `Gestion-Presence-FST-Windows.exe` build target.

- [ ] **Step 1: Add failing no-WebView contract test**

```python
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / "windows/GestionPresenceFST.Native/GestionPresenceFST.Native.csproj"


def test_official_windows_project_is_native_wpf():
    text = PROJECT.read_text(encoding="utf-8")
    assert "<UseWPF>true</UseWPF>" in text
    assert "WebView2" not in text
    assert "web/index.html" not in text
```

- [ ] **Step 2: Verify RED**

```bash
python -m pytest tests/test_windows_native_contract.py -q
```

- [ ] **Step 3: Create minimal native project**

Use:

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>net8.0-windows</TargetFramework>
    <UseWPF>true</UseWPF>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <AssemblyName>Gestion-Presence-FST-Windows</AssemblyName>
  </PropertyGroup>
</Project>
```

Create an xUnit test project referencing the native project.

- [ ] **Step 4: Build and test**

```bash
dotnet test windows/GestionPresenceFST.Native.Tests/GestionPresenceFST.Native.Tests.csproj
dotnet build windows/GestionPresenceFST.Native/GestionPresenceFST.Native.csproj -c Release
python -m pytest tests/test_windows_native_contract.py -q
```

- [ ] **Step 5: Commit**

```bash
git add windows/GestionPresenceFST.Native windows/GestionPresenceFST.Native.Tests tests/test_windows_native_contract.py
git commit -m "feat(windows): establish native WPF application"
```

---

### Task 2: Implement native authentication/session services

**Files:**
- Create: `windows/GestionPresenceFST.Native/Auth/CredentialMode.cs`
- Create: `windows/GestionPresenceFST.Native/Auth/AuthSession.cs`
- Create: `windows/GestionPresenceFST.Native/Auth/IAuthService.cs`
- Create: `windows/GestionPresenceFST.Native/Auth/SupabaseAuthService.cs`
- Create: `windows/GestionPresenceFST.Native/Auth/ISessionStore.cs`
- Create: `windows/GestionPresenceFST.Native/Auth/ProtectedSessionStore.cs`
- Test: `windows/GestionPresenceFST.Native.Tests/Auth/SupabaseAuthServiceTests.cs`

**Interfaces:**

```csharp
public enum CredentialMode { Pin, Password }
public sealed record AuthSession(string AccessToken, string RefreshToken, string UserId, string Role, long ExpiresAt);
public interface IAuthService {
    Task<AuthSession> LoginAsync(string identifier, string credential, CredentialMode mode, CancellationToken ct);
    Task<AuthSession> RefreshAsync(string refreshToken, CancellationToken ct);
    Task LogoutAsync(AuthSession session, CancellationToken ct);
}
```

- [ ] **Step 1: Write failing service tests**

Use a fake `HttpMessageHandler` to assert PIN calls `pin-login`, password calls `password-login`, and neither path invokes a factor/MFA endpoint.

- [ ] **Step 2: Run tests and verify RED**

```bash
dotnet test windows/GestionPresenceFST.Native.Tests/GestionPresenceFST.Native.Tests.csproj --filter Auth
```

- [ ] **Step 3: Implement services**

`SupabaseAuthService` posts the common payloads and maps standard session fields. `ProtectedSessionStore` protects refresh/session material with Windows DPAPI (`ProtectedData.Protect/Unprotect`, `DataProtectionScope.CurrentUser`). Never persist the PIN/password.

- [ ] **Step 4: Re-run tests**

```bash
dotnet test windows/GestionPresenceFST.Native.Tests/GestionPresenceFST.Native.Tests.csproj --filter Auth
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add windows/GestionPresenceFST.Native windows/GestionPresenceFST.Native.Tests
git commit -m "feat(windows): add native authentication services"
```

---

### Task 3: Implement API repositories and typed error mapping

**Files:**
- Create: `windows/GestionPresenceFST.Native/Api/ApiErrorCode.cs`
- Create: `windows/GestionPresenceFST.Native/Api/ApiException.cs`
- Create: `windows/GestionPresenceFST.Native/Api/SupabaseApiClient.cs`
- Create: `windows/GestionPresenceFST.Native/Data/IPresenceRepository.cs`
- Create: `windows/GestionPresenceFST.Native/Data/PresenceRepository.cs`
- Create: model records under `windows/GestionPresenceFST.Native/Models/`
- Test: `windows/GestionPresenceFST.Native.Tests/Data/PresenceRepositoryTests.cs`

**Interfaces:**

```csharp
public interface IPresenceRepository {
    Task<IReadOnlyList<AcademicClass>> GetClassesAsync(CancellationToken ct);
    Task<IReadOnlyList<Student>> GetStudentsAsync(CancellationToken ct);
    Task<IReadOnlyList<TeachingSession>> GetSessionsAsync(CancellationToken ct);
    Task<AttendanceSheet> GetAttendanceSheetAsync(Guid sessionId, CancellationToken ct);
    Task<AttendanceSheet> SaveAttendanceSheetAsync(Guid sessionId, long expectedRevision, Guid operationId, IReadOnlyList<AttendanceDraft> records, string? justification, CancellationToken ct);
}
```

- [ ] **Step 1: Write failing repository tests**

Test bearer token propagation, JSON object/singleton-array decoding, `VERSION_CONFLICT`, `FORBIDDEN`, and session-expiry mapping.

- [ ] **Step 2: Verify RED**

```bash
dotnet test windows/GestionPresenceFST.Native.Tests/GestionPresenceFST.Native.Tests.csproj --filter PresenceRepository
```

- [ ] **Step 3: Implement typed client/repository**

Map only the shared stable errors. For attendance, always call the versioned RPC and never issue independent attendance-row writes.

- [ ] **Step 4: Run tests**

```bash
dotnet test windows/GestionPresenceFST.Native.Tests/GestionPresenceFST.Native.Tests.csproj
```

- [ ] **Step 5: Commit**

```bash
git add windows/GestionPresenceFST.Native windows/GestionPresenceFST.Native.Tests
git commit -m "feat(windows): add Supabase repositories"
```

---

### Task 4: Build native shell and login UI

**Files:**
- Create: `windows/GestionPresenceFST.Native/Views/LoginView.xaml`
- Create: `windows/GestionPresenceFST.Native/ViewModels/LoginViewModel.cs`
- Create: `windows/GestionPresenceFST.Native/Views/MainWindow.xaml`
- Create: `windows/GestionPresenceFST.Native/ViewModels/MainViewModel.cs`
- Test: `windows/GestionPresenceFST.Native.Tests/ViewModels/LoginViewModelTests.cs`

**Interfaces:**
- `LoginViewModel.LoginCommand` calls `IAuthService.LoginAsync` and on success requests navigation directly to the shell.

- [ ] **Step 1: Add failing ViewModel tests**

Test default PIN mode, password mode switch, disabled submit while loading, generic invalid credential error, and direct post-login navigation.

- [ ] **Step 2: Verify RED**

```bash
dotnet test windows/GestionPresenceFST.Native.Tests/GestionPresenceFST.Native.Tests.csproj --filter LoginViewModel
```

- [ ] **Step 3: Implement XAML/C# UI**

Use native `TextBox`, `PasswordBox`, `RadioButton`, `Button`, `ContentControl`, and commands. No browser control. Main shell exposes native navigation for dashboard, classes, timetable, students, sessions, attendance, reports, account, and admin area when authorized.

- [ ] **Step 4: Run tests/build**

```bash
dotnet test windows/GestionPresenceFST.Native.Tests/GestionPresenceFST.Native.Tests.csproj
dotnet build windows/GestionPresenceFST.Native/GestionPresenceFST.Native.csproj -c Release
```

- [ ] **Step 5: Commit**

```bash
git add windows/GestionPresenceFST.Native windows/GestionPresenceFST.Native.Tests
git commit -m "feat(windows): add native shell and login"
```

---

### Task 5: Implement native business screens

**Files:**
- Create paired XAML/ViewModel files for `Dashboard`, `Classes`, `Timetable`, `Students`, `Sessions`, `Attendance`, `Reports`, `Account`, and `AdminTeachers` under `Views/` and `ViewModels/`.
- Test ViewModels under `windows/GestionPresenceFST.Native.Tests/ViewModels/`.

**Interfaces:**
- All screens depend on `IPresenceRepository`/admin service interfaces, not XAML controls.

- [ ] **Step 1: Add ViewModel tests per screen**

Test load/empty/error state, role visibility, edits, refresh, and navigation. Attendance tests must include successful save and stale-revision conflict requiring reload.

- [ ] **Step 2: Run tests and verify RED**

```bash
dotnet test windows/GestionPresenceFST.Native.Tests/GestionPresenceFST.Native.Tests.csproj
```

- [ ] **Step 3: Implement native screens**

Use WPF `DataGrid`, `ListView`, `ComboBox`, `DatePicker`, forms, dialogs, and commands. Preserve business capabilities from the spec; admin teacher management is visible only for server-confirmed `admin` role.

- [ ] **Step 4: Verify tests/build and static no-WebView rule**

```bash
dotnet test windows/GestionPresenceFST.Native.Tests/GestionPresenceFST.Native.Tests.csproj
dotnet build windows/GestionPresenceFST.Native/GestionPresenceFST.Native.csproj -c Release
python -m pytest tests/test_windows_native_contract.py -q
```

- [ ] **Step 5: Commit**

```bash
git add windows/GestionPresenceFST.Native windows/GestionPresenceFST.Native.Tests
git commit -m "feat(windows): implement native presence workflows"
```

---

### Task 6: Retire WebView2 wrapper from official build and add Windows CI

**Files:**
- Modify/create Windows solution/build scripts to reference `GestionPresenceFST.Native` only.
- Create/Modify: `.github/workflows/verify-native-windows.yml`
- Test: `tests/test_windows_native_contract.py`

**Interfaces:**
- Official artifact is built only from `windows/GestionPresenceFST.Native`.

- [ ] **Step 1: Extend static test**

Assert official workflow/project text contains neither `GestionPresenceFSTOnline`, `Microsoft.Web.WebView2`, nor embedded `web/index.html`.

- [ ] **Step 2: Verify test failure before workflow change**

```bash
python -m pytest tests/test_windows_native_contract.py -q
```

- [ ] **Step 3: Update CI**

Workflow steps: restore, xUnit tests, Python native-contract test, Release build/publish, artifact upload. Do not build the WebView2 wrapper as an official product.

- [ ] **Step 4: Run local-equivalent verification and GitHub Actions**

Expected: all checks green and a native Windows artifact produced.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/verify-native-windows.yml tests/test_windows_native_contract.py
git commit -m "ci(windows): build native WPF client only"
```

---

### Task 7: Cross-platform staging acceptance and release

**Files:**
- Create: `tests/cross_client/test_cross_client_contract.py`
- Create: `docs/release/2026-08-30-cross-platform-acceptance.md`
- Modify relevant Web/Android/Windows workflows for release artifacts.

**Interfaces:**
- Validates Web, Android, Windows against one staging Supabase contract before production promotion.

- [ ] **Step 1: Add cross-client contract checks**

Verify all clients expose only PIN/password, share stable errors, call the same attendance RPC, and contain no MFA/AAL2 business gate. Verify Windows official source has no WebView2/HTML dependency.

- [ ] **Step 2: Run staging functional matrix**

For teacher and admin, test PIN login, password login, logout, session refresh, authorized navigation, forbidden operation, attendance read/save, conflict handling, and cross-client visibility of a staging write.

- [ ] **Step 3: Run full CI**

Required green gates:
- backend/security tests;
- Web tests;
- Android unit tests + lint + APK build;
- Windows xUnit + native-contract + Release build.

- [ ] **Step 4: Promote backend then clients**

Deploy backend first, verify production non-destructively, then publish Web, Windows, and Android artifacts. If a gate fails, stop promotion; do not partially declare release success.

- [ ] **Step 5: Record artifact hashes and acceptance evidence**

Document GitHub run IDs, artifact names, SHA-256 hashes, production schema/app contract version, and data-count preservation evidence in `docs/release/2026-08-30-cross-platform-acceptance.md`.

- [ ] **Step 6: Commit**

```bash
git add tests/cross_client docs/release .github/workflows
git commit -m "test(release): verify cross-platform presence clients"
```

## Completion Gate

- Windows official artifact is fully native WPF with no WebView2/HTML.
- Web, Android, and Windows support PIN/password only.
- All three use one Supabase backend and server-enforced authorization.
- Cross-client attendance synchronization and conflict behavior are verified.
- Production data is preserved.
- All release workflows are green and final artifact hashes recorded.
