# Gestion Présence FST Native Windows Application Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current WebView2 wrapper with a true Windows 10/11 x64 WPF application that reproduces the approved Gestion Présence FST behavior without HTML, JavaScript, browser windows, WebView2, localhost, or offline mutation queues.

**Architecture:** Keep one WPF executable organized with MVVM presentation, application services, and a replaceable Supabase gateway. The existing Supabase tables, RLS behavior, RPC `teacher_directory`, Edge Functions `admin-pin-login` and `admin-teacher`, field names, status values, and online-only semantics remain authoritative. Native PDF/CSV/JSON services replace browser-based rendering/export.

**Tech Stack:** .NET 8 WPF, C# 12, XAML, CommunityToolkit.Mvvm 8.4.2, Supabase 1.6.2, CsvHelper 33.1.0, PDFsharp 6.2.4, xUnit 2.9.3, Microsoft.NET.Test.Sdk 17.14.1, Inno Setup on GitHub Actions Windows runner.

**Spec:** `docs/superpowers/specs/2026-08-30-native-windows-app-design.md`

## Global Constraints

- Target: Windows 10/11 x64.
- Technology: .NET 8, WPF, C#, XAML, MVVM.
- No browser launcher.
- No WebView2.
- No local HTTP server or 127.0.0.1 dependency.
- No HTML, JavaScript, CSS or WebView rendering code shipped inside the native application.
- No redesign of the Supabase database unless a backend incompatibility is proven.
- No use of a service_role/secret key or database password in the desktop client.
- Online-only: no local edit/sync queue; writes are committed only after Supabase confirms success.
- Preserve tables `profiles`, `classes`, `students`, `sessions`, `attendance`.
- Preserve RPC `teacher_directory` and Edge Functions `admin-pin-login`, `admin-teacher`.
- Preserve attendance values exactly: `present`, `absent`, `retard`, `justifie`.
- Preserve attendance fields `comment`, nullable `grade` /20, and `grade_updated_at`.
- Current HTML mapping is authoritative: `teacher_id`, `class_id`, `session_id`, `student_id`, `session_date`, `start_time`, `end_time`, `completed_at`, `class_number`, `group_number`, `day`, `room`.
- Teacher synthetic auth email remains `normalize(username) + "@presence-app.local"`, where normalization is lower-case and retains only `a-z`, `0-9`, `.`, `_`, `-`.
- Installer is per-user under LocalAppData/Programs, creates Desktop and Start Menu shortcuts, and has a normal uninstall entry.

---

### Task 1: Convert the Windows project to a native WPF foundation

**Files:**
- Modify: `windows/GestionPresenceFST/GestionPresenceFST.csproj`
- Modify: `windows/GestionPresenceFST/App.xaml`
- Modify: `windows/GestionPresenceFST/App.xaml.cs`
- Delete: `windows/GestionPresenceFST/MainWindow.xaml`
- Delete: `windows/GestionPresenceFST/MainWindow.xaml.cs`
- Create: `windows/GestionPresenceFST/Windows/ShellWindow.xaml`
- Create: `windows/GestionPresenceFST/Windows/ShellWindow.xaml.cs`
- Create: `windows/GestionPresenceFST/Windows/LoginWindow.xaml`
- Create: `windows/GestionPresenceFST/Windows/LoginWindow.xaml.cs`
- Create: `windows/GestionPresenceFST/Infrastructure/AppComposition.cs`
- Create: `windows/GestionPresenceFST/Resources/Theme.xaml`
- Create: `windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj`
- Create: `windows/GestionPresenceFST.Tests/Architecture/NativeProjectTests.cs`

**Interfaces:**
- Produces: `AppComposition.Build()` returning the application service registry used by `App.OnStartup`.
- Produces: native `LoginWindow` and `ShellWindow` with no WebView/browser control.

- [ ] **Step 1: Write the failing architecture test**

```csharp
public sealed class NativeProjectTests
{
    [Fact]
    public void Project_contains_no_webview_or_embedded_web_assets()
    {
        var root = TestPaths.RepositoryRoot;
        var csproj = File.ReadAllText(Path.Combine(root, "windows", "GestionPresenceFST", "GestionPresenceFST.csproj"));
        Assert.DoesNotContain("WebView2", csproj, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("web\\index.html", csproj, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("fst_patch", csproj, StringComparison.OrdinalIgnoreCase);
    }
}
```

- [ ] **Step 2: Run the test and verify RED**

Run: `dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj --filter NativeProjectTests`
Expected: FAIL because the current project contains `Microsoft.Web.WebView2` and embedded web assets.

- [ ] **Step 3: Replace the project dependencies and startup shell**

Use these pinned runtime packages in the application project:

```xml
<ItemGroup>
  <PackageReference Include="CommunityToolkit.Mvvm" Version="8.4.2" />
  <PackageReference Include="Supabase" Version="1.6.2" />
  <PackageReference Include="CsvHelper" Version="33.1.0" />
  <PackageReference Include="PDFsharp-wpf" Version="6.2.4" />
</ItemGroup>
```

Set `<ApplicationIcon>Assets\GestionPresenceFST.ico</ApplicationIcon>`, remove every WebView2/content reference, and start with `LoginWindow` from `App.OnStartup` rather than `StartupUri`.

- [ ] **Step 4: Run the architecture test and compile**

Run: `dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj`
Expected: PASS.

Run: `dotnet build windows/GestionPresenceFST/GestionPresenceFST.csproj -c Debug`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add windows/GestionPresenceFST windows/GestionPresenceFST.Tests
git commit -m "feat: establish native WPF application shell"
```

---

### Task 2: Define domain models and exact Supabase row mappings

**Files:**
- Create: `windows/GestionPresenceFST/Domain/Profile.cs`
- Create: `windows/GestionPresenceFST/Domain/ClassGroup.cs`
- Create: `windows/GestionPresenceFST/Domain/Student.cs`
- Create: `windows/GestionPresenceFST/Domain/TeachingSession.cs`
- Create: `windows/GestionPresenceFST/Domain/AttendanceRecord.cs`
- Create: `windows/GestionPresenceFST/Domain/AttendanceStatus.cs`
- Create: `windows/GestionPresenceFST/Data/Rows/ProfileRow.cs`
- Create: `windows/GestionPresenceFST/Data/Rows/ClassRow.cs`
- Create: `windows/GestionPresenceFST/Data/Rows/StudentRow.cs`
- Create: `windows/GestionPresenceFST/Data/Rows/SessionRow.cs`
- Create: `windows/GestionPresenceFST/Data/Rows/AttendanceRow.cs`
- Create: `windows/GestionPresenceFST/Data/RowMapper.cs`
- Create: `windows/GestionPresenceFST.Tests/Data/RowMapperTests.cs`
- Create: `windows/GestionPresenceFST.Tests/Domain/AttendanceRecordTests.cs`

**Interfaces:**
- Produces: `RowMapper.ToDomain(...)` and `RowMapper.ToRow(...)` for every table.
- Produces: `AttendanceRecord.SetGrade(decimal? value, DateTimeOffset now)`.

- [ ] **Step 1: Write failing mapping and validation tests**

```csharp
[Fact]
public void Attendance_mapping_preserves_database_contract()
{
    var row = new AttendanceRow
    {
        Id = "a1", TeacherId = "t1", SessionId = "s1", StudentId = "st1",
        Status = "retard", Comment = "10 min", Grade = 15.5m,
        GradeUpdatedAt = DateTimeOffset.Parse("2026-08-30T10:00:00Z")
    };
    var model = RowMapper.ToDomain(row);
    Assert.Equal(AttendanceStatus.Retard, model.Status);
    Assert.Equal(15.5m, model.Grade);
    Assert.Equal("10 min", model.Comment);
}

[Theory]
[InlineData(-0.1)]
[InlineData(20.1)]
public void Grade_must_be_between_zero_and_twenty(decimal value)
{
    var record = AttendanceRecord.Create("a", "t", "s", "st");
    Assert.Throws<ArgumentOutOfRangeException>(() => record.SetGrade(value, DateTimeOffset.UtcNow));
}
```

- [ ] **Step 2: Verify RED**

Run: `dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj --filter "RowMapperTests|AttendanceRecordTests"`
Expected: FAIL because models/mappers do not exist.

- [ ] **Step 3: Implement exact row contracts**

Use Supabase/PostgREST attributes so field names match the existing application exactly. Example:

```csharp
[Table("attendance")]
public sealed class AttendanceRow : BaseModel
{
    [PrimaryKey("id", false)] public string Id { get; set; } = "";
    [Column("teacher_id")] public string TeacherId { get; set; } = "";
    [Column("session_id")] public string SessionId { get; set; } = "";
    [Column("student_id")] public string StudentId { get; set; } = "";
    [Column("status")] public string Status { get; set; } = "present";
    [Column("comment")] public string Comment { get; set; } = "";
    [Column("grade")] public decimal? Grade { get; set; }
    [Column("grade_updated_at")] public DateTimeOffset? GradeUpdatedAt { get; set; }
    [Column("updated_at")] public DateTimeOffset? UpdatedAt { get; set; }
}
```

`ClassRow` must map `name`, `track`, `class_number`, `group_number`, `module`, `day`, `start_time`, `end_time`, `room`. `SessionRow` must map `session_date`, `start_time`, `end_time`, `completed_at`.

- [ ] **Step 4: Verify GREEN**

Run: `dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj --filter "RowMapperTests|AttendanceRecordTests"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add windows/GestionPresenceFST/Domain windows/GestionPresenceFST/Data windows/GestionPresenceFST.Tests
git commit -m "feat: add native domain and Supabase mappings"
```

---

### Task 3: Implement Supabase gateway, authentication and protected session persistence

**Files:**
- Create: `windows/GestionPresenceFST/Data/ISupabaseGateway.cs`
- Create: `windows/GestionPresenceFST/Data/SupabaseGateway.cs`
- Create: `windows/GestionPresenceFST/Security/ISessionStore.cs`
- Create: `windows/GestionPresenceFST/Security/DpapiSessionStore.cs`
- Create: `windows/GestionPresenceFST/Services/IAuthService.cs`
- Create: `windows/GestionPresenceFST/Services/AuthService.cs`
- Create: `windows/GestionPresenceFST/ViewModels/LoginViewModel.cs`
- Create: `windows/GestionPresenceFST.Tests/Services/AuthServiceTests.cs`
- Create: `windows/GestionPresenceFST.Tests/Security/DpapiSessionStoreTests.cs`

**Interfaces:**
- `Task<AuthResult> IAuthService.SignInAsync(string username, string credential, LoginMode mode, CancellationToken ct)`
- `Task<AuthResult?> IAuthService.RestoreAsync(CancellationToken ct)`
- `Task SignOutAsync(CancellationToken ct)`
- `Task<FunctionResult<T>> ISupabaseGateway.InvokeFunctionAsync<T>(string name, object body, CancellationToken ct)`
- `Task<Profile?> ISupabaseGateway.GetProfileAsync(string userId, CancellationToken ct)`

- [ ] **Step 1: Write failing auth-flow tests**

```csharp
[Fact]
public async Task Teacher_login_tries_admin_pin_then_email_password_fallback()
{
    var gateway = new FakeGateway { AdminPinLoginSucceeds = false, PasswordLoginSucceeds = true };
    var service = new AuthService(gateway, new MemorySessionStore());
    var result = await service.SignInAsync("Prof.Test", "1234", LoginMode.Teacher, default);
    Assert.True(result.Success);
    Assert.Equal("prof.test@presence-app.local", gateway.LastPasswordEmail);
    Assert.Equal(new[] { "admin-pin-login", "signInWithPassword" }, gateway.AuthCalls);
}

[Fact]
public async Task Admin_mode_rejects_non_admin_profile()
{
    var gateway = FakeGateway.AdminPinUser(role: "teacher");
    var service = new AuthService(gateway, new MemorySessionStore());
    var result = await service.SignInAsync("teacher1", "1234", LoginMode.Admin, default);
    Assert.False(result.Success);
    Assert.Equal("Ce compte ne possède pas les droits administrateur.", result.ErrorMessage);
}
```

- [ ] **Step 2: Verify RED**

Run: `dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj --filter AuthServiceTests`
Expected: FAIL.

- [ ] **Step 3: Implement the approved auth contract**

Normalization must be implemented exactly:

```csharp
public static string NormalizeUsername(string value) =>
    Regex.Replace((value ?? "").Trim().ToLowerInvariant(), "[^a-z0-9._-]", "");

public static string TeacherAuthEmail(string username) =>
    NormalizeUsername(username) + "@presence-app.local";
```

Teacher mode: call `admin-pin-login` with `{ identifier = username, credential }`; when it returns `access_token` and `refresh_token`, set that session. Otherwise call password auth with the synthetic email. Admin mode: only `admin-pin-login`, then verify `profiles.role == "admin"`. Save access/refresh session via DPAPI under `%LocalAppData%\GestionPresenceFST\session.bin`; never log token values.

- [ ] **Step 4: Verify GREEN**

Run: `dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj --filter "AuthServiceTests|DpapiSessionStoreTests"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add windows/GestionPresenceFST/Data windows/GestionPresenceFST/Security windows/GestionPresenceFST/Services windows/GestionPresenceFST/ViewModels windows/GestionPresenceFST.Tests
git commit -m "feat: implement native Supabase authentication"
```

---

### Task 4: Implement authoritative data services for classes, students and sessions

**Files:**
- Create: `windows/GestionPresenceFST/Services/ClassService.cs`
- Create: `windows/GestionPresenceFST/Services/StudentService.cs`
- Create: `windows/GestionPresenceFST/Services/SessionService.cs`
- Create: `windows/GestionPresenceFST/ViewModels/ClassesViewModel.cs`
- Create: `windows/GestionPresenceFST/ViewModels/StudentsViewModel.cs`
- Create: `windows/GestionPresenceFST/ViewModels/SessionsViewModel.cs`
- Create: `windows/GestionPresenceFST/Views/ClassesView.xaml`
- Create: `windows/GestionPresenceFST/Views/ClassesView.xaml.cs`
- Create: `windows/GestionPresenceFST/Views/StudentsView.xaml`
- Create: `windows/GestionPresenceFST/Views/StudentsView.xaml.cs`
- Create: `windows/GestionPresenceFST/Views/SessionsView.xaml`
- Create: `windows/GestionPresenceFST/Views/SessionsView.xaml.cs`
- Create: `windows/GestionPresenceFST.Tests/Services/DataCrudTests.cs`

**Interfaces:**
- `Task<IReadOnlyList<ClassGroup>> ClassService.LoadAsync(UserContext user, CancellationToken ct)`
- `Task<ClassGroup> ClassService.CreateAsync(NewClassInput input, UserContext user, CancellationToken ct)`
- `Task DeleteAsync(string id, UserContext user, CancellationToken ct)` for class/student/session services.
- `Task<TeachingSession> SessionService.CreateAsync(NewSessionInput input, UserContext user, CancellationToken ct)`.

- [ ] **Step 1: Write failing payload tests**

```csharp
[Fact]
public async Task Class_create_uses_existing_database_columns()
{
    var gateway = new RecordingGateway();
    var service = new ClassService(gateway);
    await service.CreateAsync(new NewClassInput("MPI", 2, 3, "Mécanique", "Lundi", "08:00", "10:00", "B12"), User.Teacher("t1"), default);
    var row = Assert.IsType<ClassRow>(gateway.LastUpsert.Single());
    Assert.Equal("t1", row.TeacherId);
    Assert.Equal(2, row.ClassNumber);
    Assert.Equal(3, row.GroupNumber);
    Assert.Equal("08:00", row.StartTime);
}

[Fact]
public async Task Teacher_load_filters_students_by_teacher_id()
{
    var gateway = new RecordingGateway();
    await new StudentService(gateway).LoadAsync(User.Teacher("t1"), default);
    Assert.Equal(("students", "teacher_id", "t1"), gateway.LastFilter);
}
```

- [ ] **Step 2: Verify RED**

Run: `dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj --filter DataCrudTests`
Expected: FAIL.

- [ ] **Step 3: Implement CRUD with server confirmation before UI mutation**

Create IDs with `Guid.NewGuid().ToString()`. For new classes send `teacher_id`, `name`, `track`, `class_number`, `group_number`, `module`, `day`, `start_time`, `end_time`, `room`. For students send `teacher_id`, `class_id`, `last_name`, `first_name`, nullable `email`. For sessions send `teacher_id`, `class_id`, `session_date`, `start_time`, `end_time`; completion sets `completed_at = DateTimeOffset.UtcNow` via upsert.

After successful writes, reload the affected authoritative collection from Supabase. Do not insert optimistic local rows before success.

- [ ] **Step 4: Verify GREEN and native UI bindings**

Run: `dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj --filter DataCrudTests`
Expected: PASS.

Run: `dotnet build windows/GestionPresenceFST/GestionPresenceFST.csproj -c Debug`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add windows/GestionPresenceFST/Services windows/GestionPresenceFST/ViewModels windows/GestionPresenceFST/Views windows/GestionPresenceFST.Tests
git commit -m "feat: add native class student and session workflows"
```

---

### Task 5: Implement native attendance editing, grades and session completion

**Files:**
- Create: `windows/GestionPresenceFST/Services/AttendanceService.cs`
- Create: `windows/GestionPresenceFST/ViewModels/AttendanceViewModel.cs`
- Create: `windows/GestionPresenceFST/ViewModels/AttendanceStudentRowViewModel.cs`
- Create: `windows/GestionPresenceFST/Views/AttendanceView.xaml`
- Create: `windows/GestionPresenceFST/Views/AttendanceView.xaml.cs`
- Create: `windows/GestionPresenceFST.Tests/Services/AttendanceServiceTests.cs`

**Interfaces:**
- `Task<IReadOnlyList<AttendanceRecord>> LoadForSessionAsync(string sessionId, UserContext user, CancellationToken ct)`
- `Task SaveSessionAsync(string sessionId, IReadOnlyCollection<AttendanceRecord> records, UserContext user, CancellationToken ct)`
- `Task CompleteSessionAsync(string sessionId, IReadOnlyCollection<AttendanceRecord> records, UserContext user, CancellationToken ct)`

- [ ] **Step 1: Write failing attendance tests**

```csharp
[Theory]
[InlineData("present")]
[InlineData("absent")]
[InlineData("retard")]
[InlineData("justifie")]
public void Stored_status_values_are_exact(string status)
{
    Assert.True(AttendanceStatusCodec.TryParse(status, out var parsed));
    Assert.Equal(status, AttendanceStatusCodec.ToDatabase(parsed));
}

[Fact]
public async Task Complete_session_saves_attendance_before_completed_at()
{
    var gateway = new RecordingGateway();
    var service = new AttendanceService(gateway);
    await service.CompleteSessionAsync("s1", new[] { AttendanceRecord.Create("a1", "t1", "s1", "st1") }, User.Teacher("t1"), default);
    Assert.Equal(new[] { "upsert:attendance", "upsert:sessions" }, gateway.WriteOrder);
}
```

- [ ] **Step 2: Verify RED**

Run: `dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj --filter AttendanceServiceTests`
Expected: FAIL.

- [ ] **Step 3: Implement attendance workflow**

Rows sent to Supabase must contain `id`, `teacher_id`, `session_id`, `student_id`, `status`, `comment`, `grade`, `grade_updated_at`. Default new record status is `present`, comment is empty, grade is null. When a grade value changes, set `grade_updated_at` to UTC now. Grade accepts null or `0 <= grade <= 20`.

The native WPF grid must expose four explicit status choices and an editable numeric grade column. Completed sessions remain editable for grades, matching the current application.

- [ ] **Step 4: Verify GREEN**

Run: `dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj --filter AttendanceServiceTests`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add windows/GestionPresenceFST/Services/AttendanceService.cs windows/GestionPresenceFST/ViewModels/Attendance* windows/GestionPresenceFST/Views/Attendance* windows/GestionPresenceFST.Tests
git commit -m "feat: implement native attendance and grading"
```

---

### Task 6: Build dashboard, reports, native PDF, CSV and JSON import/export

**Files:**
- Create: `windows/GestionPresenceFST/Services/ReportService.cs`
- Create: `windows/GestionPresenceFST/Services/PdfService.cs`
- Create: `windows/GestionPresenceFST/Services/ImportExportService.cs`
- Create: `windows/GestionPresenceFST/ViewModels/DashboardViewModel.cs`
- Create: `windows/GestionPresenceFST/ViewModels/ReportsViewModel.cs`
- Create: `windows/GestionPresenceFST/Views/DashboardView.xaml`
- Create: `windows/GestionPresenceFST/Views/DashboardView.xaml.cs`
- Create: `windows/GestionPresenceFST/Views/ReportsView.xaml`
- Create: `windows/GestionPresenceFST/Views/ReportsView.xaml.cs`
- Create: `windows/GestionPresenceFST.Tests/Services/ReportServiceTests.cs`
- Create: `windows/GestionPresenceFST.Tests/Services/ImportExportServiceTests.cs`

**Interfaces:**
- `SessionReport BuildSessionReport(...)`
- `AttendanceSummary BuildSummary(...)`
- `void PdfService.WriteSessionReport(SessionReport report, Stream output)`
- `Task<ImportResult> ImportStudentsCsvAsync(Stream csv, UserContext user, CancellationToken ct)`
- `Task ExportAttendanceCsvAsync(Stream output, UserContext user, CancellationToken ct)`
- `Task ExportAdminBackupJsonAsync(Stream output, CancellationToken ct)`

- [ ] **Step 1: Write failing aggregation/import tests**

```csharp
[Fact]
public void Summary_counts_all_four_presence_states()
{
    var records = new[] { "present", "present", "absent", "retard", "justifie" }
        .Select((s, i) => AttendanceRecord.FromStored($"a{i}", "t", "s", $"st{i}", s, "", null, null));
    var summary = new ReportService().BuildSummary(records);
    Assert.Equal(2, summary.Present);
    Assert.Equal(1, summary.Absent);
    Assert.Equal(1, summary.Late);
    Assert.Equal(1, summary.Excused);
}

[Fact]
public async Task Csv_import_accepts_nom_prenom_email_classe_order()
{
    var csv = "Nom,Prénom,Email,Classe\nBen Ali,Sami,sami@example.tn,MPI 1 G1\n";
    var result = await ServiceWithFakeGateway().ImportStudentsCsvAsync(new MemoryStream(Encoding.UTF8.GetBytes(csv)), User.Teacher("t1"), default);
    Assert.Equal(1, result.StudentCount);
}
```

- [ ] **Step 2: Verify RED**

Run: `dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj --filter "ReportServiceTests|ImportExportServiceTests"`
Expected: FAIL.

- [ ] **Step 3: Implement reporting/export**

Session report metadata must include institution, academic year `2026/2027`, teacher, track, class number, group number, module, date, start/end time, room and rows containing student, status, comment and grade displayed as `x /20` or `—`.

Use PDFsharp WPF APIs to draw native PDF pages; do not render HTML. CSV importer must accept comma or semicolon delimiters and preserve current behavior of creating a missing class using its text name with module `Général` and null timetable fields. Validate input size before parsing. Admin JSON backup must serialize profiles/classes/students/sessions/attendance using existing field names.

- [ ] **Step 4: Verify GREEN and inspect generated PDF structurally**

Run: `dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj --filter "ReportServiceTests|ImportExportServiceTests"`
Expected: PASS.

Add a test that writes a PDF to `MemoryStream` and asserts the header starts `%PDF-` and stream length is greater than 500 bytes.

- [ ] **Step 5: Commit**

```bash
git add windows/GestionPresenceFST/Services windows/GestionPresenceFST/ViewModels/DashboardViewModel.cs windows/GestionPresenceFST/ViewModels/ReportsViewModel.cs windows/GestionPresenceFST/Views/Dashboard* windows/GestionPresenceFST/Views/Reports* windows/GestionPresenceFST.Tests
git commit -m "feat: add native reports pdf and import export"
```

---

### Task 7: Implement timetable, teacher directory, account settings and administration

**Files:**
- Create: `windows/GestionPresenceFST/Services/TimetableService.cs`
- Create: `windows/GestionPresenceFST/Services/TeacherAdminService.cs`
- Create: `windows/GestionPresenceFST/ViewModels/TimetableViewModel.cs`
- Create: `windows/GestionPresenceFST/ViewModels/TeachersViewModel.cs`
- Create: `windows/GestionPresenceFST/ViewModels/AdministrationViewModel.cs`
- Create: `windows/GestionPresenceFST/Views/TimetableView.xaml`
- Create: `windows/GestionPresenceFST/Views/TeachersView.xaml`
- Create: `windows/GestionPresenceFST/Views/AdministrationView.xaml`
- Create: `windows/GestionPresenceFST/Windows/ChangePinDialog.xaml`
- Create: `windows/GestionPresenceFST.Tests/Services/TeacherAdminServiceTests.cs`

**Interfaces:**
- `Task<IReadOnlyList<TeacherDirectoryEntry>> LoadTeacherDirectoryAsync(CancellationToken ct)` using RPC `teacher_directory`.
- `Task CreateTeacherAsync(string fullName, string username, string password, CancellationToken ct)`.
- `Task SetAdminRoleAsync(string userId, bool isAdmin, CancellationToken ct)`.
- `Task ResetPasswordAsync(string userId, string password, CancellationToken ct)`.
- `Task DeleteTeacherAsync(string userId, CancellationToken ct)`.
- `Task SetAdminPinAsync(string pin, CancellationToken ct)`.

- [ ] **Step 1: Write failing Edge Function payload tests**

```csharp
[Fact]
public async Task Admin_actions_use_existing_admin_teacher_contract()
{
    var gateway = new RecordingGateway();
    var service = new TeacherAdminService(gateway);
    await service.SetAdminRoleAsync("u1", true, default);
    Assert.Equal("admin-teacher", gateway.LastFunctionName);
    Assert.Equal("set_admin_role", gateway.LastBody["action"]);
    Assert.Equal("u1", gateway.LastBody["user_id"]);
    Assert.Equal(true, gateway.LastBody["is_admin"]);
}
```

- [ ] **Step 2: Verify RED**

Run: `dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj --filter TeacherAdminServiceTests`
Expected: FAIL.

- [ ] **Step 3: Implement exact admin contracts**

Use `admin-teacher` bodies exactly:

```text
{ action: "capabilities" }
{ action: "create", full_name, username, password }
{ action: "set_admin_role", user_id, is_admin }
{ action: "reset_password", user_id, password }
{ action: "delete", user_id }
{ action: "set_admin_pin", pin }
```

Timetable loads classes with non-null `day`, ordered/grouped by day and `start_time`. Teacher directory uses RPC `teacher_directory`. Admin views also load `profiles` fields `id,email,username,full_name,role,created_at`.

- [ ] **Step 4: Verify GREEN**

Run: `dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj --filter TeacherAdminServiceTests`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add windows/GestionPresenceFST/Services windows/GestionPresenceFST/ViewModels windows/GestionPresenceFST/Views windows/GestionPresenceFST/Windows/ChangePinDialog* windows/GestionPresenceFST.Tests
git commit -m "feat: add native timetable teacher and admin modules"
```

---

### Task 8: Add connectivity, realtime refresh, navigation and native visual parity

**Files:**
- Create: `windows/GestionPresenceFST/Services/ConnectivityService.cs`
- Create: `windows/GestionPresenceFST/Services/RealtimeService.cs`
- Create: `windows/GestionPresenceFST/ViewModels/ShellViewModel.cs`
- Create: `windows/GestionPresenceFST/Views/ConnectivityOverlay.xaml`
- Modify: `windows/GestionPresenceFST/Windows/ShellWindow.xaml`
- Modify: `windows/GestionPresenceFST/Resources/Theme.xaml`
- Create: `windows/GestionPresenceFST.Tests/Services/ConnectivityServiceTests.cs`
- Create: `windows/GestionPresenceFST.Tests/Services/RealtimeServiceTests.cs`

**Interfaces:**
- `Task<ConnectivityState> ConnectivityService.CheckAsync(CancellationToken ct)` performs a real backend probe, not only NIC status.
- `IAsyncDisposable RealtimeService.Subscribe(UserContext user, Func<Task> refresh, CancellationToken ct)`.
- `ShellViewModel.IsBackendAvailable` controls write command availability and overlay visibility.

- [ ] **Step 1: Write failing connectivity tests**

```csharp
[Fact]
public async Task Network_adapter_without_successful_backend_probe_is_offline_required()
{
    var service = new ConnectivityService(new FakeNetwork(true), new FakeBackendProbe(false));
    var state = await service.CheckAsync(default);
    Assert.False(state.CanWrite);
    Assert.True(state.ShowOnlineRequiredOverlay);
}

[Fact]
public async Task Realtime_events_are_debounced_into_one_refresh()
{
    var scheduler = new ManualScheduler();
    var service = new RealtimeService(new FakeRealtimeSource(), scheduler);
    var count = 0;
    await using var sub = service.Subscribe(User.Teacher("t1"), () => { count++; return Task.CompletedTask; }, default);
    service.AcceptTestEvent(); service.AcceptTestEvent(); service.AcceptTestEvent();
    scheduler.AdvanceBy(TimeSpan.FromMilliseconds(400));
    Assert.Equal(1, count);
}
```

- [ ] **Step 2: Verify RED**

Run: `dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj --filter "ConnectivityServiceTests|RealtimeServiceTests"`
Expected: FAIL.

- [ ] **Step 3: Implement online-only state and navigation**

Show native text equivalent to: `Connexion Internet requise` and `Cette application fonctionne uniquement en ligne. Aucune modification n’est enregistrée localement.` with a `Réessayer` command. Disable create/edit/delete/save commands when backend probe fails. Realtime changes on the five application tables trigger a debounced authoritative reload; disconnect does not create an offline queue.

Shell navigation must expose Dashboard, Classes, Étudiants, Séances, Présence, Rapports, Emploi du temps, Enseignants and Administration when authorized. Use institutional blue/white resources, native cards, DataGrids, buttons and status badges; no browser-like chrome.

- [ ] **Step 4: Verify GREEN and search banned dependencies**

Run: `dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj --filter "ConnectivityServiceTests|RealtimeServiceTests"`
Expected: PASS.

Run: `git grep -n -Ei "WebView2|127\.0\.0\.1|localhost|<html|javascript:" -- windows/GestionPresenceFST || true`
Expected: no matches in application source.

- [ ] **Step 5: Commit**

```bash
git add windows/GestionPresenceFST windows/GestionPresenceFST.Tests
git commit -m "feat: add native connectivity realtime and shell navigation"
```

---

### Task 9: Add Windows packaging, installer and CI verification

**Files:**
- Create: `windows/installer/GestionPresenceFST.iss`
- Create: `windows/scripts/verify-native.ps1`
- Modify: `.github/workflows/build-windows.yml`
- Create: `windows/GestionPresenceFST/Assets/GestionPresenceFST.ico`

**Interfaces:**
- Produces: `Gestion-Presence-FST.exe` self-contained win-x64.
- Produces: `Gestion-Presence-FST-Setup.exe` per-user installer.

- [ ] **Step 1: Write the failing packaging verifier**

```powershell
$ErrorActionPreference = 'Stop'
$exe = Join-Path $PSScriptRoot '..\publish\Gestion-Presence-FST.exe'
if (-not (Test-Path $exe)) { throw 'Gestion-Presence-FST.exe missing' }
$deps = Get-ChildItem (Split-Path $exe) -Recurse -File | Select-Object -ExpandProperty Name
if ($deps -match 'WebView2') { throw 'WebView2 dependency detected' }
$source = Get-ChildItem (Join-Path $PSScriptRoot '..\GestionPresenceFST') -Recurse -File | Get-Content -Raw
if ($source -match '127\.0\.0\.1|localhost|WebView2') { throw 'Browser/local-server dependency detected' }
```

- [ ] **Step 2: Run verifier before packaging and verify RED**

Run on Windows runner: `pwsh windows/scripts/verify-native.ps1`
Expected: FAIL because publish output/installer do not exist yet.

- [ ] **Step 3: Implement publish and Inno Setup**

Publish command:

```powershell
dotnet publish windows/GestionPresenceFST/GestionPresenceFST.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o windows/publish
```

Inno Setup must use `PrivilegesRequired=lowest`, install under `{localappdata}\Programs\Gestion Presence FST`, create `{autodesktop}` and `{userprograms}` shortcuts, use the application icon, and register uninstall normally.

Update GitHub Actions to run tests first, publish, run `verify-native.ps1`, compile the `.iss`, and upload both the portable publish artifact and `Gestion-Presence-FST-Setup.exe`. Remove the old `Prepare web source` step and every check for `web/index.html` or patch JS/CSS.

- [ ] **Step 4: Verify GREEN on Windows runner**

Run: `dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj -c Release`
Expected: all tests PASS.

Run: `pwsh windows/scripts/verify-native.ps1`
Expected: exit 0.

Run Inno Setup compiler and assert `Gestion-Presence-FST-Setup.exe` exists.

- [ ] **Step 5: Commit**

```bash
git add windows/installer windows/scripts windows/GestionPresenceFST/Assets .github/workflows/build-windows.yml
git commit -m "build: package native Windows application"
```

---

### Task 10: Execute full regression and acceptance verification

**Files:**
- Create: `windows/GestionPresenceFST.Tests/Architecture/NoBrowserDependencyTests.cs`
- Create: `windows/ACCEPTANCE.md`
- Modify only defects discovered by the verification below.

**Interfaces:**
- Produces final verification evidence for native behavior and all functional modules.

- [ ] **Step 1: Add final no-browser regression test**

```csharp
[Fact]
public void Application_source_contains_no_browser_or_local_server_runtime()
{
    var files = Directory.EnumerateFiles(TestPaths.ApplicationRoot, "*.*", SearchOption.AllDirectories)
        .Where(p => p.EndsWith(".cs") || p.EndsWith(".xaml") || p.EndsWith(".csproj"));
    var text = string.Join("\n", files.Select(File.ReadAllText));
    Assert.DoesNotContain("WebView2", text, StringComparison.OrdinalIgnoreCase);
    Assert.DoesNotContain("127.0.0.1", text, StringComparison.OrdinalIgnoreCase);
    Assert.DoesNotContain("localhost", text, StringComparison.OrdinalIgnoreCase);
}
```

- [ ] **Step 2: Run all automated tests**

Run: `dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj -c Release --no-restore`
Expected: 0 failed tests.

- [ ] **Step 3: Run Release build and native packaging checks**

Run: `dotnet publish windows/GestionPresenceFST/GestionPresenceFST.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o windows/publish`
Expected: exit 0 and `Gestion-Presence-FST.exe` present.

Run: `pwsh windows/scripts/verify-native.ps1`
Expected: exit 0 and no WebView2/browser/localhost dependencies.

- [ ] **Step 4: Execute functional acceptance against Supabase with a disposable test data set**

Record PASS/FAIL in `windows/ACCEPTANCE.md` for:

```text
Teacher sign-in
Admin sign-in
Restore authenticated session
Load existing classes/students/sessions/attendance
Create and delete test class
Create and delete test student
CSV student import
Create and delete test session
Edit four attendance statuses
Save comment and grade /20
Complete session and edit grade afterwards
Generate session PDF
Generate attendance summary/PDF
Open dashboard/reports/timetable/teacher directory
Create/reset/promote-demote/delete disposable teacher account
Set admin PIN where current backend capability permits it
Admin backup JSON and attendance CSV export
Realtime refresh after remote database change
Network interruption -> write actions disabled + retry overlay
Network recovery -> authoritative refresh succeeds
Close/reopen app -> no Edge/Chrome/default browser process is launched by the app
Installer -> Desktop shortcut, Start Menu shortcut, uninstall entry
```

Delete all disposable test records/accounts at the end through the same supported APIs.

- [ ] **Step 5: Final commit**

```bash
git add windows/ACCEPTANCE.md windows/GestionPresenceFST.Tests windows/GestionPresenceFST
git commit -m "test: verify native Windows application acceptance"
```

---

## Plan self-review

- Spec coverage: authentication/session, dashboard, CRUD, attendance/grades, reports/PDF, timetable, teacher directory, administration, import/export, realtime, connectivity and packaging are each assigned to explicit tasks.
- Source contract coverage: exact current field names and server endpoints from the approved HTML are represented in Tasks 2, 3, 4, 5 and 7.
- Browser-removal coverage: Task 1 removes WebView2/assets; Tasks 8, 9 and 10 enforce permanent no-browser/no-localhost regression checks.
- Security coverage: no service-role/database secret, DPAPI session storage, no token logging, RLS/backend authority retained.
- Type consistency: all services consume `UserContext`; Supabase integration is isolated behind `ISupabaseGateway`; domain/row conversion is centralized in `RowMapper`.
- No offline mutation queue is introduced; connectivity failures disable writes and preserve server-authoritative state.
