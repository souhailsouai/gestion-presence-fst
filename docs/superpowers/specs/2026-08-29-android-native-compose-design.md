# Gestion Présence FST — Android Native Design

Date: 2026-08-29
Status: Approved design
Academic year: 2026/2027

## 1. Objective
Replace the existing Android WebView wrapper with a genuine native Android application for FST attendance management. The Windows/browser HTML application remains separate. Android must provide native interaction, adaptive layout, reliable offline operation, background synchronization, and native PDF generation.

## 2. Technology
- Kotlin
- Jetpack Compose + Material 3
- Navigation Compose
- MVVM / repository architecture
- Room for local structured data
- WorkManager for deferred/background synchronization
- Supabase backend and authentication
- Android PdfDocument for PDF reports
- Hilt for dependency injection
- DataStore for non-sensitive preferences

## 3. Native UI
No WebView is used for the application interface. Main destinations: Splash, Login, Home, Classes/Groups, Students, Sessions, Attendance, Grades, Reports, Administration, Settings/Sync.

Phone navigation uses a compact Material 3 bottom navigation for primary destinations and native secondary screens. Forms, dialogs, date/time controls, lists, status indicators, loading/error states and confirmation prompts are Compose components.

The visual identity uses FST institutional navy, gold and white. The launcher uses a simplified FST-inspired adaptive icon with foreground/background layers. Official FST/UTM branding may appear inside the application where assets are available.

## 4. Roles
Teacher:
- authenticate
- access assigned classes/groups
- manage students where authorized
- create/manage sessions
- record attendance and observations
- record/edit grades /20
- generate session reports

Admin:
- all teacher capabilities
- manage teachers
- manage all classes/groups/students/sessions
- reports and audit visibility
- application/synchronization administration

An admin account may enter either Admin or Teacher workspace without changing its persisted database role.

## 5. Academic structure
- MPI1 through MPI5
- PC1
- each class supports 3 or 4 TP groups
- academic year 2026/2027
- grades are optional and constrained to 0–20
- attendance states: present, absent, late, justified

## 6. Offline-first data model
Room is the application's working database. The UI reads from Room rather than directly depending on the network. Network operations reconcile Room with Supabase.

Every synchronizable entity includes a stable UUID, remote version/revision information, updated timestamp, author/user id, synchronization state and deletion/tombstone state where required.

All normal operational features remain usable offline: classes/groups, students, sessions, attendance, grades, observations and report generation. Administrative mutations that require server-side authentication/privilege enforcement are queued locally when technically safe and finalized after reconnection; the UI must clearly distinguish pending server confirmation from completed server changes.

## 7. Synchronization
Local mutations are written transactionally to Room and an outbox. WorkManager processes the outbox when connectivity is available, sends mutations to Supabase, receives authoritative revisions, then refreshes affected local records.

Synchronization states exposed to the UI: synchronized, offline, pending, synchronizing, conflict, error.

Conflicts must not silently overwrite data. Before applying a remote update, the repository compares the base/revision known when the local edit was made with the current remote revision. Non-conflicting records merge automatically. A true same-record conflict is retained locally and surfaced for resolution rather than discarded. Audit metadata records actor and timestamps.

## 8. Authentication and security
- Supabase Auth remains authoritative for identity.
- Authorization is enforced server-side by RLS/privileged server functions, never only by the Android UI.
- No service-role secret is embedded in the APK.
- Sensitive authentication material uses Android-protected storage appropriate to the Supabase client/session implementation.
- Offline access after a previously authenticated session is allowed only to locally cached data belonging to the authorized account/workspace.
- Administrative operations are revalidated by the backend when synchronized.

## 9. PDF reports
PDF generation is native and does not require Internet access. A session PDF contains institution/year, teacher, track/class/group, module, date/time, student list, attendance state, optional grade /20, observations and attendance statistics.

The generated PDF can be previewed, saved through Android storage APIs, shared through Android Sharesheet and printed through the Android print framework where supported.

## 10. Error handling
Network failure never destroys a completed local attendance operation. Failed synchronization remains in the outbox with a visible error/pending state and retry behavior. Validation errors are shown adjacent to the relevant native form. Authentication expiration triggers controlled reauthentication without deleting unsynchronized local work.

## 11. Testing
- unit tests for domain validation and synchronization decisions
- Room DAO/repository tests
- conflict/outbox tests
- Compose UI tests for login, attendance and grade entry
- offline/reconnect integration tests
- PDF generation test asserting a valid non-empty PDF
- build verification proving the Android app does not load its main UI through WebView
- adaptive icon/resource verification

## 12. Migration strategy
The native Android application is introduced on a dedicated feature branch. Existing Supabase data remains the backend source. The old WebView Android implementation is replaced only after native login, core attendance, offline persistence, synchronization and PDF report flows pass verification. The browser/Windows HTML application is not removed by this Android rewrite.
