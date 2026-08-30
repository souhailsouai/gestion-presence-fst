# Gestion Présence FST — Native Windows Application Design

Date: 2026-08-30
Status: Proposed for user review — implementation not started
Source of functional truth: Gestion-Presence-FST-HTML-Final-2026-2027(1).html

## 1. Goal

Rebuild Gestion Présence FST as a true native Windows desktop application. The delivered application must not open or embed a browser, must not use HTML/CSS/JavaScript/WebView2, and must preserve the functional behavior and Supabase data model of the approved final HTML application.

Target: Windows 10/11 x64.
Technology: .NET 8, WPF, C#, XAML, MVVM.

## 2. Non-goals

- No browser launcher.
- No WebView2.
- No local HTTP server or 127.0.0.1 dependency.
- No redesign of the Supabase database unless a backend incompatibility is proven.
- No use of a service_role/secret key in the desktop client.
- No offline editing/synchronization queue, because the approved final application is online-only.

## 3. Functional scope

The native application must reproduce the current final application's modules:

1. Secure login with Teacher/Admin mode.
2. Persistent authenticated session and logout/switch-account.
3. Teacher/admin profile and role handling.
4. Dashboard and recent sessions.
5. Classes and TP groups: create, list, edit where supported, delete.
6. Students: create, list, CSV import, delete.
7. Sessions: create, list, date/time validation, delete, completion.
8. Attendance sheet per session with status and optional note /20.
9. Attendance save and completed-session workflow.
10. Attendance reports and session reports.
11. Native PDF generation/export.
12. Global timetable.
13. Teacher directory.
14. Administration: create teacher, reset PIN/password, promote/demote admin, delete teacher.
15. Admin backup/export and attendance CSV export; restore/import where supported by current behavior.
16. Change own PIN/password and admin PIN operation.
17. Realtime refresh from Supabase.
18. Explicit online-required state with retry when Supabase/Internet is unavailable.

## 4. Native UI architecture

The UI is rebuilt entirely with WPF controls and XAML. A ShellWindow hosts a left navigation rail and a content region. Each major module is a native UserControl/Page with its own ViewModel.

Primary screens:
- LoginWindow
- ShellWindow
- DashboardView
- ClassesView
- StudentsView
- SessionsView
- AttendanceView
- ReportsView
- TimetableView
- TeachersView
- AdministrationView
- ChangePinDialog
- ConnectivityOverlay

The visual language should remain close to the approved application: institutional blue/white palette, compact cards, status badges, readable DataGrids, FST/UTM branding, responsive resizing for desktop/laptop widths.

## 5. Application layering

### Presentation
WPF/XAML views and MVVM ViewModels. Views contain no database logic.

### Application services
- AuthService
- ProfileService
- ClassService
- StudentService
- SessionService
- AttendanceService
- ReportService
- TeacherAdminService
- TimetableService
- RealtimeService
- ConnectivityService
- ImportExportService
- PdfService

### Data/integration
A single SupabaseGateway encapsulates the Supabase C# client. The Supabase package is pinned to a tested version. Current Supabase C# reference supports email/password auth, RPC and Edge Function invocation; these capabilities map to the existing web application's backend calls. Supabase documents C# as a community-supported client, so the gateway boundary is mandatory to keep that dependency replaceable without rewriting the UI or domain services.

The gateway exposes interfaces so the application is not coupled directly to the third-party client in ViewModels.

## 6. Existing Supabase contract to preserve

Tables used by the approved application:
- profiles
- classes
- students
- sessions
- attendance

Existing server-side endpoints to preserve:
- RPC: teacher_directory
- Edge Function: admin-pin-login
- Edge Function: admin-teacher

The native client uses the existing publishable/anon client key and the authenticated user's JWT. It never embeds a service_role/secret key.

Authorization remains enforced by the existing Supabase RLS/backend rules. The desktop application must not implement client-side checks as a replacement for RLS.

## 7. Authentication/session design

Teacher login:
- Prefer the same flow as the approved application: attempt admin-pin-login where required by current compatibility behavior, otherwise email/password sign-in.
- Load profiles row for the authenticated user.
- Enforce Admin mode only when profile.role == admin.

Admin login:
- Invoke admin-pin-login.
- Set returned access/refresh session.
- Validate profiles.role == admin.

Session persistence:
- Access/refresh session data stored locally using Windows protected storage/DPAPI rather than plaintext configuration.
- On startup, restore and validate the session against Supabase.
- If validation fails, return to LoginWindow.

## 8. Data models

Native C# models mirror the current database contract and current HTML mappings, including UUID/string identifiers and nullable timetable fields.

Core entities:
- Profile
- ClassGroup
- Student
- TeachingSession
- AttendanceRecord

Attendance preserves the exact stored status values used by the current application: `present`, `absent`, `retard`, and `justifie`, plus `comment`, optional numeric `grade` /20, and `grade_updated_at`.

## 9. Data loading and ownership

Teacher mode loads only records permitted for that teacher under the current backend/RLS model. Admin mode can load cross-teacher views where the existing application currently does so.

The authoritative source is Supabase. UI collections are refreshed after successful writes. No local mutation is considered committed until Supabase confirms it.

## 10. Realtime behavior

Preserve the current live-refresh behavior using Supabase Realtime/Postgres Changes through the C# integration. Realtime events trigger debounced refreshes of affected collections.

If Realtime disconnects, the application remains online-capable through normal HTTPS operations and attempts to reconnect. It must not silently switch to an offline-editing mode.

## 11. Connectivity/error handling

A ConnectivityService combines network reachability with actual Supabase request success. Merely having a network adapter is not considered sufficient.

When the backend is unavailable:
- disable write actions;
- show a native modal/overlay equivalent to "Connexion Internet requise";
- expose Retry;
- preserve the authenticated session when appropriate;
- never report a write as saved until confirmed by Supabase.

Errors are converted into concise user-facing French messages. Diagnostic details can be written to a local rotating log under LocalAppData without storing PINs/passwords/tokens.

## 12. Reports, PDF and import/export

Reports are generated from native C# models, not HTML rendering.

PDF requirements:
- session attendance report;
- general attendance report;
- institution/title/date/teacher/class metadata;
- attendance summary and student rows;
- optional grade display matching current behavior.

CSV import preserves the current expected columns: Nom, Prénom, Email, Classe. JSON backup/restore and attendance CSV export preserve current administrative formats as closely as practical so existing backups remain usable.

## 13. Security

- Never embed service_role or database password.
- Do not log credentials or JWTs.
- Store refresh/session material with Windows protected storage.
- Treat role checks in the UI as presentation only; Supabase RLS/Edge Functions remain authoritative.
- Keep dependencies version-pinned.
- Validate imported file size/format before processing.

## 14. Packaging

Deliverables:
- Gestion-Presence-FST.exe
- Gestion-Presence-FST-Setup.exe

Installer behavior:
- per-user install under LocalAppData/Programs unless administrator-wide installation is explicitly requested later;
- Desktop shortcut;
- Start Menu shortcut;
- application icon in EXE, installer and shortcuts;
- clean uninstall entry in Windows Apps;
- no Edge/WebView runtime dependency introduced by the application.

## 15. Testing and acceptance criteria

Implementation uses test-first development for application/service behavior.

Required automated coverage:
- model mapping between C# and Supabase rows;
- teacher/admin authentication flow;
- authorization-mode behavior;
- CRUD payloads for classes/students/sessions/attendance;
- attendance status/grade validation;
- report aggregation;
- CSV import/export;
- session persistence wrapper;
- connectivity/error states.

Build verification:
- Release x64 build succeeds on Windows runner;
- executable is a native Windows desktop application and contains no WebView2 dependency;
- installer creates Desktop and Start Menu shortcuts;
- launch does not open Edge/Chrome/default browser;
- no localhost/127.0.0.1 listener is used.

Functional acceptance:
- sign in as teacher and admin;
- load existing Supabase data;
- create/delete a test class, student and session;
- save attendance and optional grade;
- complete a session and generate PDF;
- open timetable/report/admin modules;
- validate teacher administration operations;
- validate realtime refresh;
- validate behavior after network interruption and reconnection.

## 16. Implementation boundary

The approved final HTML is the behavioral reference only. No HTML, JavaScript, CSS or WebView rendering code is shipped inside the native application.
