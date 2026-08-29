# Windows EXE + Shared HTML Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Windows desktop executable using the same HTML/Supabase application as Android and browser, then expose the updated shared HTML as a downloadable artifact.

**Architecture:** Keep one canonical HTML file at `web/index.html`. Android and Windows consume this same file. Windows uses .NET 8 WPF + Microsoft WebView2; Android keeps its existing WebView wrapper. GitHub Actions builds a Windows x64 distributable and validates the shared HTML.

**Tech Stack:** HTML/CSS/JavaScript, Supabase JS, .NET 8 WPF, Microsoft.Web.WebView2, GitHub Actions.

**Global Constraints:** Preserve Supabase synchronization and authentication. Preserve 2026/2027 academic year and FST/UTM branding. Windows and Android must not maintain divergent HTML copies.

### Task 1: Canonical shared HTML
- Create `web/index.html` from the current validated Android HTML.
- Add a CI assertion that `web/index.html` is non-empty and contains the institutional app markers.
- Make Android build copy `web/index.html` to `app/src/main/assets/index.html` before build.

### Task 2: Windows desktop wrapper
- Create `windows/GestionPresenceFST` WPF .NET 8 project.
- Add Microsoft.Web.WebView2 package.
- Create a border-safe responsive WebView2 window loading `web/index.html` from the published output.
- Add application title, startup sizing, minimum size, and maximized-window support.

### Task 3: Windows build workflow
- Create `.github/workflows/build-windows.yml` on `windows-latest`.
- Restore and publish `win-x64` Release output.
- Upload the complete distributable as `Gestion-Presence-FST-Windows`.

### Task 4: Verification
- Run HTML validation assertions in CI.
- Build Android after canonical-source copy.
- Build Windows Release publish.
- Only provide `.exe`/ZIP and updated HTML after both source validation and Windows build succeed.
