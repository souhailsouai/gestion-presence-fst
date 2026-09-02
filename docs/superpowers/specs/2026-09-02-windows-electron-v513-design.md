# Windows Electron V5.13 Design

## Goal
Build a Windows 10/11 x64 desktop application derived from the immutable App presence V5.13 web baseline, preserving its behavior while packaging it as a secure Electron application that remains online-only and uses the existing Supabase backend.

## Stable baseline
- Canonical web version: V5.13.
- Canonical artifact: `Gestion_Presence_FST_TP_MPI_PC_WEB_V5_13.html`.
- Authoritative SHA-256: `73daccbc12f1e9d0068a53a5d3f7052f3002a49963ce3842f3fa6040650538e8`.
- Backend: Supabase project `Gestion-Presence`, project ref `dbslzmvzbxczpqyektpx`.
- The V5.13 release branch is immutable. Windows work is derived on `feature/windows-electron-v513`.

## Scope
The first Windows release wraps the V5.13 application in Electron without changing its business rules. It must preserve Admin and Teacher authentication, teacher PIN login, planning, balanced teacher assignment, attendance/grades behavior, PDF generation, native Word `.docx` generation, downloads, and printing.

Out of scope for this first Windows release:
- offline operation;
- local database or local synchronization engine;
- automatic updater;
- replacement of Supabase authentication;
- rewriting the V5.13 UI in a native Windows framework;
- privileged Supabase service-role access from the desktop client.

## Target platform and deliverables
Target: Windows 10 and Windows 11, x64 only.

Produce two distributables from the same source:
1. `Gestion Presence FST Setup.exe`: installable NSIS package with Start Menu integration and optional desktop shortcut.
2. `Gestion Presence FST Portable.exe`: portable executable requiring no installation.

Both artifacts must expose the same application behavior and connect to the same production Supabase backend.

## Architecture
The application has three layers:

1. **V5.13 renderer**: the existing HTML/CSS/JavaScript application remains the functional UI baseline.
2. **Electron shell**: owns the `BrowserWindow`, application lifecycle, download handling, printing integration, navigation policy, and desktop packaging.
3. **Supabase backend**: continues to provide authentication, database access, RLS, Edge Functions, planning RPCs, and all authoritative shared data.

No local application server is required. The renderer is loaded from packaged local files. Network access is restricted to the endpoints required by the application, principally the Supabase project and the external resources already required by V5.13.

## Electron security model
The renderer must not receive direct Node.js privileges.

Required `BrowserWindow.webPreferences`:
- `nodeIntegration: false`;
- `contextIsolation: true`;
- `sandbox: true`;
- `webSecurity: true`;
- `allowRunningInsecureContent: false`.

Additional rules:
- do not embed any Supabase `service_role` key, database password, GitHub token, or other privileged secret;
- only the existing public Supabase client configuration used by V5.13 may be present in renderer code;
- keep RLS and Supabase server-side authorization as the security boundary;
- deny arbitrary navigation away from the packaged application;
- open approved external links in the user's default browser rather than in an unrestricted Electron window;
- deny new renderer windows unless explicitly handled;
- block unexpected permission requests;
- expose no generic filesystem, shell, process, command execution, or unrestricted IPC API to the renderer;
- Electron DevTools are disabled in production builds.

A preload script may expose only narrowly-scoped desktop capabilities that are genuinely required. If V5.13 functions without preload APIs, no renderer-facing API should be exposed.

## Network policy
The application is online-only. Loss of internet connectivity must not create local shadow data.

Expected behavior:
- authentication and Supabase reads/writes fail cleanly when offline;
- the renderer remains open and shows the existing application errors or a concise connectivity message;
- retrying after connectivity returns must use the normal V5.13 flows;
- no queued attendance, grades, planning changes, or authentication operations are stored for later replay by Electron.

## Authentication
The Windows app must preserve V5.13 authentication exactly:
- Teacher: identifier + six-digit PIN through the existing Supabase/Edge Function flow;
- Admin: existing separate Admin authentication flow;
- Electron does not add a Windows-local credential store or alternate password mechanism.

Auth sessions may use the same browser storage behavior already expected by the Supabase JavaScript client. The shell must not log PINs, passwords, magic-link tokens, access tokens, or refresh tokens.

## Downloads, PDF, Word and printing
V5.13 export behavior must remain functional in the desktop package:
- student daily PDFs;
- native Word `.docx` daily planning files;
- other existing file downloads;
- browser print flows.

Electron must handle renderer downloads using the Chromium download system and save files through normal Windows download/save behavior. No file content is sent to a new backend service.

Printing must use Chromium/Electron print support and preserve the layouts already validated in V5.13. The Windows wrapper must not alter the generated document data model.

## Navigation and external resources
The packaged renderer starts from the local V5.13 entry file. Navigation to arbitrary HTTP/HTTPS pages in the main application window is denied.

Approved external links, when intentionally activated by the user, are delegated to the system browser. Supabase requests, CDN/library requests required by V5.13, and download requests are network requests rather than top-level navigation and remain allowed according to the packaged Content Security Policy and application needs.

## Content Security Policy
The packaged application must use a Content Security Policy compatible with V5.13 while reducing unnecessary origins. The implementation plan must inventory actual V5.13 external origins before finalizing the CSP. Do not add `unsafe-eval`. Keep `unsafe-inline` only if unavoidable for the existing single-file application, and document it as a compatibility constraint if retained.

## Application identity
Product name: `Gestion Presence FST`.

Windows packaging metadata must use a stable application ID so future versions can upgrade the installed application instead of installing alongside it. Versioning for the first Windows package should identify that it is derived from V5.13, for example `5.13.0`.

The Windows application must visibly remain the same App presence product; no functional rebranding is required.

## Build system
Use Electron with `electron-builder`.

The source layout should separate responsibilities:
- Electron main process;
- optional preload bridge;
- packaged V5.13 renderer asset;
- build/package configuration;
- security/navigation helpers;
- automated tests.

The V5.13 renderer asset must be copied from the verified baseline, not manually re-created. A build-time integrity check must compare its SHA-256 to the authoritative V5.13 hash and fail packaging if it differs unexpectedly.

## Artifact integrity
The Windows build must preserve traceability to V5.13.

Build metadata must record:
- source baseline version V5.13;
- V5.13 SHA-256;
- Windows package version;
- build commit SHA when available.

After packaging, calculate SHA-256 hashes for both `Setup.exe` and `Portable.exe` and report them with the delivered artifacts.

## Error handling
Desktop-specific errors must fail safely:
- missing renderer asset: stop startup and show a clear fatal error;
- renderer hash mismatch: fail the build, not silently package modified V5.13;
- blocked navigation: cancel navigation without crashing;
- download failure: surface a concise Windows-facing error;
- lost network: leave the application running and permit normal retry;
- Supabase authorization errors: remain governed by V5.13/RLS and are not bypassed by Electron.

No error handler may fall back to privileged credentials or bypass RLS.

## Testing and acceptance criteria
The Windows release is acceptable only if all of the following pass.

### Static/security tests
- `nodeIntegration` is false;
- `contextIsolation` is true;
- sandbox is enabled;
- unrestricted navigation and popup creation are denied;
- no `service_role` or privileged secret exists in packaged source;
- renderer SHA-256 matches the V5.13 baseline before packaging.

### Functional smoke tests
On Windows 10/11 x64 or a compatible Windows CI runner:
- application launches and closes normally;
- Admin login works;
- Teacher identifier + six-digit PIN login works;
- Supabase data loads;
- planning views load;
- V5.13 balanced assignment UI remains available to Admin;
- attendance/grade flows remain available according to the V5.13 permissions;
- PDF export works;
- `.docx` export works;
- files download successfully;
- print dialog/printing works;
- external links do not replace the main app window;
- no Node.js API is available in renderer page JavaScript.

### Packaging tests
- x64 Setup EXE is produced;
- x64 Portable EXE is produced;
- install/uninstall works for Setup package;
- portable build launches without installation;
- both connect to the same Supabase production backend;
- SHA-256 hashes are generated for both deliverables.

## Release strategy
This first Electron version is intentionally conservative. It packages the stable V5.13 application rather than changing business behavior. Future desktop versions may add updater support or Windows-specific features only as separately designed changes.

V5.13 remains the canonical stable web baseline and must not be overwritten by Windows packaging work.