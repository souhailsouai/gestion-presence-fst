# Professional Web UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the existing HTML attendance system into a compact, professional university management Web UI while preserving all current Supabase, authentication, session, administration, reporting, and data workflows.

**Architecture:** Keep the application as a single existing HTML entry point to minimize regression risk, but reorganize presentation through new CSS variables, layout wrappers, navigation structure, dashboard sections, and small UI helper functions. Preserve existing DOM IDs and business functions wherever practical. No duplicate authentication or mobile business logic is allowed.

**Tech Stack:** HTML5, CSS3, vanilla JavaScript, Supabase JS 2.57.4, existing Edge Functions and existing client-side PDF/CSV logic.

**Spec:** `docs/superpowers/specs/2026-08-29-professional-web-ui-design.md`

## Global Constraints
- Academic year remains exactly `2026/2027`.
- Preserve the existing Supabase URL/key usage, authentication paths, RLS assumptions, Edge Functions and current data model.
- Keep exactly one `loginTeacher()` implementation.
- Preserve persistent-session restoration and explicit logout/account switching.
- Do not alter the native Android APK.
- Web UI must remain visually distinct from the APK.
- Synchronization status in the top bar must be color-only: green synchronized, orange pending/syncing, red error, gray offline, blue connecting.
- Sync indicator must still expose accessible text via `title`/ARIA.
- Do not fabricate dashboard metrics unavailable from existing data.

---

### Task 1: Add UI regression contract tests

**Files:**
- Create: `tests/test_professional_web_ui.py`
- Read/modify later: `app/src/main/assets/index.html`

**Interfaces:**
- Tests inspect the real HTML file and fail when required structure or preserved behavior is missing.

- [ ] **Step 1: Write failing tests**

```python
from pathlib import Path

HTML = Path('app/src/main/assets/index.html').read_text(encoding='utf-8')

def test_single_login_teacher_definition():
    assert HTML.count('function loginTeacher(') == 1

def test_professional_shell_markers_exist():
    assert 'management-sidebar' in HTML
    assert 'management-topbar' in HTML
    assert 'management-workspace' in HTML

def test_sync_indicator_is_color_based():
    assert 'sync-status-dot' in HTML
    assert 'aria-label="État de synchronisation"' in HTML

def test_persistent_session_restoration_is_preserved():
    assert 'auth.getSession' in HTML or 'restoreSession' in HTML

def test_academic_year_is_preserved():
    assert '2026/2027' in HTML
```

- [ ] **Step 2: Run the tests**

Run: `python -m pytest tests/test_professional_web_ui.py -q`

Expected: shell/sync-indicator tests FAIL because the professional UI has not yet been implemented; login/session/year tests should reflect current behavior.

- [ ] **Step 3: Commit the failing test contract**

```bash
git add tests/test_professional_web_ui.py
git commit -m "test(web): define professional UI contract"
```

---

### Task 2: Introduce professional design tokens and base layout

**Files:**
- Modify: `app/src/main/assets/index.html` CSS variables/base styles

**Interfaces:**
- Produces CSS classes: `.management-shell`, `.management-sidebar`, `.management-topbar`, `.management-workspace`, `.management-main`.

- [ ] **Step 1: Add professional tokens**

Use exact core values:

```css
:root {
  --mgmt-navy:#0b2748;
  --mgmt-navy-2:#12395f;
  --mgmt-gold:#c9952e;
  --mgmt-bg:#f3f5f7;
  --mgmt-surface:#ffffff;
  --mgmt-border:#dce2e8;
  --mgmt-text:#1d2733;
  --mgmt-muted:#6c7885;
  --mgmt-radius:10px;
  --mgmt-sidebar:244px;
}
```

- [ ] **Step 2: Replace page-level decorative gradient styling**

Set the authenticated app body/workspace to neutral management-system surfaces; keep login-specific institutional styling scoped to the login overlay only.

- [ ] **Step 3: Add desktop shell CSS**

Sidebar fixed/column layout; topbar height around 64px; content workspace fluid and dense. Avoid oversized cards and mobile-style floating actions.

- [ ] **Step 4: Re-run tests**

Run: `python -m pytest tests/test_professional_web_ui.py -q`

Expected: professional shell marker test may still fail until markup task is complete; no existing test regresses.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/assets/index.html
git commit -m "style(web): add management system design tokens"
```

---

### Task 3: Refactor authenticated application shell

**Files:**
- Modify: `app/src/main/assets/index.html` authenticated container/header/navigation markup

**Interfaces:**
- Preserve existing nav tab IDs/classes and event handlers.
- Add wrapper classes required by Task 1 tests.

- [ ] **Step 1: Wrap the current application in management shell markup**

Target hierarchy:

```html
<div class="management-shell">
  <aside class="management-sidebar">...</aside>
  <section class="management-workspace">
    <header class="management-topbar">...</header>
    <main class="management-main">...</main>
  </section>
</div>
```

- [ ] **Step 2: Move existing navigation buttons into the sidebar without changing their IDs/events**

Keep current section switching logic intact.

- [ ] **Step 3: Put user identity and contextual actions in topbar**

Keep current-user label, logout/account switching, admin-only controls and role visibility rules.

- [ ] **Step 4: Run UI contract tests**

Run: `python -m pytest tests/test_professional_web_ui.py -q`

Expected: shell marker test PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/assets/index.html
git commit -m "feat(web): add professional management shell"
```

---

### Task 4: Replace textual sync status with accessible color indicator

**Files:**
- Modify: `app/src/main/assets/index.html` sync markup, CSS and `setSyncStatus()`
- Test: `tests/test_professional_web_ui.py`

**Interfaces:**
- Produces one visual element with class/id `sync-status-dot`.
- `setSyncStatus(message, state)` maps existing state/message to a CSS state class and accessible text.

- [ ] **Step 1: Extend the test**

```python
def test_sync_indicator_has_required_state_classes():
    for state in ('sync-green','sync-orange','sync-red','sync-gray','sync-blue'):
        assert state in HTML
```

- [ ] **Step 2: Run test and confirm failure**

- [ ] **Step 3: Implement the indicator**

Markup:

```html
<span id="sync-status-dot" class="sync-status-dot sync-blue"
      role="status" aria-label="État de synchronisation"
      title="Connexion au serveur"></span>
```

CSS state mapping:

```css
.sync-green{background:#1f9d55}
.sync-orange{background:#e29a1d}
.sync-red{background:#d64545}
.sync-gray{background:#89939e}
.sync-blue{background:#2f80ed}
```

`setSyncStatus()` must set class + `title`/accessible text but no permanent visible status word in the topbar.

- [ ] **Step 4: Run tests**

Expected: sync tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/main/assets/index.html tests/test_professional_web_ui.py
git commit -m "feat(web): use color-only sync status indicator"
```

---

### Task 5: Redesign dashboard for operational management

**Files:**
- Modify: `app/src/main/assets/index.html` dashboard markup/CSS/render helpers

**Interfaces:**
- Dashboard metrics derive only from existing `data.classes`, `data.students`, `data.sessions`, `data.attendance`.
- No backend changes.

- [ ] **Step 1: Add test markers for dashboard blocks**

Assert presence of `dashboard-kpi-grid`, `dashboard-today`, `dashboard-actions`, `dashboard-recent`.

- [ ] **Step 2: Run and confirm failure**

- [ ] **Step 3: Implement compact KPI grid**

Show totals already derivable: classes/groups, students, sessions, attendance summary. Only show incomplete-grade metric if it can be deterministically derived from current session/student data.

- [ ] **Step 4: Add operational panels**

Today's/upcoming sessions, quick actions, recent/current sessions. Reuse existing navigation functions/events.

- [ ] **Step 5: Run tests**

Expected: dashboard markers PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/main/assets/index.html tests/test_professional_web_ui.py
git commit -m "feat(web): redesign operational dashboard"
```

---

### Task 6: Standardize tables, filters, forms and empty states

**Files:**
- Modify: `app/src/main/assets/index.html` CSS and existing section markup

**Interfaces:**
- Preserve existing add/edit/delete handlers and IDs.
- Introduce shared classes: `.management-toolbar`, `.management-table`, `.management-panel`, `.empty-state`, `.status-badge`.

- [ ] **Step 1: Add contract tests for shared management classes**

- [ ] **Step 2: Run and confirm failure**

- [ ] **Step 3: Apply shared toolbar pattern**

Page title left, search/filter/action controls right; compact layout on desktop.

- [ ] **Step 4: Apply shared table pattern**

Consistent header, row height, hover state, action column and responsive overflow.

- [ ] **Step 5: Apply shared form/panel pattern**

Creation/edit forms become visually secondary panels/modals, not full-page dominant blocks.

- [ ] **Step 6: Add explicit empty states**

No fake data; only display empty-state messaging when arrays are empty.

- [ ] **Step 7: Run tests and commit**

```bash
git add app/src/main/assets/index.html tests/test_professional_web_ui.py
git commit -m "style(web): standardize management tables and forms"
```

---

### Task 7: Optimize attendance and grade entry

**Files:**
- Modify: `app/src/main/assets/index.html` attendance/grade section CSS/markup only where required

**Interfaces:**
- Preserve attendance values/statuses and grade validation `0..20` optional.

- [ ] **Step 1: Add tests confirming grade validation text/code remains `0..20`**

- [ ] **Step 2: Run baseline test**

- [ ] **Step 3: Improve desktop density**

Keep student identity visually fixed/clear; use compact status controls and note/observation fields; do not introduce mobile-style card stacks on desktop.

- [ ] **Step 4: Improve narrow-screen behavior**

Allow controlled horizontal scroll or structured responsive rows while keeping the same handlers.

- [ ] **Step 5: Run tests and commit**

```bash
git add app/src/main/assets/index.html tests/test_professional_web_ui.py
git commit -m "style(web): optimize attendance and grade workflow"
```

---

### Task 8: Reorganize reports and administration screens

**Files:**
- Modify: `app/src/main/assets/index.html` reports/admin presentation

**Interfaces:**
- Preserve PDF/CSV functions, `admin-teacher`, `admin-pin-login`, account creation, backup/restore and timetable logic.

- [ ] **Step 1: Add regression tests for key admin function names and Edge Function references**

Assert `admin-teacher`, `admin-pin-login`, account creation function and report export functions remain present.

- [ ] **Step 2: Run baseline tests**

- [ ] **Step 3: Reorganize reports into compact action panels/toolbars**

Do not change report generation internals.

- [ ] **Step 4: Reorganize Administration into sections**

Accounts, backup/restore/export, global timetable. Preserve admin-only visibility logic.

- [ ] **Step 5: Run tests and commit**

```bash
git add app/src/main/assets/index.html tests/test_professional_web_ui.py
git commit -m "style(web): reorganize reports and administration"
```

---

### Task 9: Professional login screen distinct from APK

**Files:**
- Modify: `app/src/main/assets/index.html` auth CSS/markup only

**Interfaces:**
- Preserve exactly one `loginTeacher()` and all current credential/role controls.

- [ ] **Step 1: Add test that login form IDs and `loginTeacher()` remain unchanged**

- [ ] **Step 2: Run baseline test**

- [ ] **Step 3: Restyle login as institutional Web software**

Desktop: institutional identity panel + compact credential panel. Mobile: stacked responsive layout. Avoid Android-like bottom navigation, splash screen patterns or large app-style cards.

- [ ] **Step 4: Run tests and commit**

```bash
git add app/src/main/assets/index.html tests/test_professional_web_ui.py
git commit -m "style(web): polish institutional login experience"
```

---

### Task 10: Responsive and accessibility pass

**Files:**
- Modify: `app/src/main/assets/index.html` CSS/ARIA attributes
- Test: `tests/test_professional_web_ui.py`

**Interfaces:**
- Desktop sidebar; mobile menu/drawer behavior shares same navigation handlers.

- [ ] **Step 1: Add tests for responsive media query and sync ARIA/title**

- [ ] **Step 2: Run and verify required failures**

- [ ] **Step 3: Add responsive breakpoints**

Representative widths: desktop >= 1024px, tablet 768–1023px, mobile < 768px.

- [ ] **Step 4: Add focus-visible states and accessible labels**

Use `:focus-visible`; ensure icon-only controls have labels/titles.

- [ ] **Step 5: Run tests and commit**

```bash
git add app/src/main/assets/index.html tests/test_professional_web_ui.py
git commit -m "style(web): complete responsive accessibility pass"
```

---

### Task 11: JavaScript and authentication regression verification

**Files:**
- Create: `scripts/verify_web_html.py`
- Test: existing HTML

**Interfaces:**
- Verification script returns non-zero on duplicate `loginTeacher`, missing persistent-session restoration, missing sync state classes, missing core admin functions or malformed script extraction.

- [ ] **Step 1: Write the verifier**

Use Python regex/string checks to extract inline scripts and ensure contract markers. If Node is available in CI/local execution, pass extracted JS blocks through `node --check` using temporary `.js` files.

- [ ] **Step 2: Run verifier**

Run: `python scripts/verify_web_html.py app/src/main/assets/index.html`

Expected: PASS only after all prior tasks are complete.

- [ ] **Step 3: Run full tests**

Run: `python -m pytest tests/test_professional_web_ui.py -q`

Expected: all PASS.

- [ ] **Step 4: Commit**

```bash
git add scripts/verify_web_html.py tests/test_professional_web_ui.py
git commit -m "test(web): add HTML and auth regression verifier"
```

---

### Task 12: Final package and visual verification

**Files:**
- Verify: `app/src/main/assets/index.html`
- Produce user-facing copy: `Gestion-Presence-FST-Web-Pro-2026-2027.html`

**Interfaces:**
- Final HTML remains standalone apart from its existing CDN/Supabase dependencies.

- [ ] **Step 1: Run full static verification**

```bash
python -m pytest tests/test_professional_web_ui.py -q
python scripts/verify_web_html.py app/src/main/assets/index.html
```

Expected: zero failures.

- [ ] **Step 2: Verify key requirements manually/staticly**

Confirm one `loginTeacher()`, persistent session, admin/teacher visibility code, no permanent visible sync word in topbar, all five sync colors, academic year 2026/2027, PDF/CSV/admin function references intact.

- [ ] **Step 3: Create distributable copy**

Copy the verified HTML to `Gestion-Presence-FST-Web-Pro-2026-2027.html` without altering contents.

- [ ] **Step 4: State validation boundary**

Report static JS/UI verification separately from end-to-end Supabase validation. Do not claim Edge Functions/RLS are empirically validated unless executed against the live project.

- [ ] **Step 5: Commit final verified Web UI**

```bash
git add app/src/main/assets/index.html Gestion-Presence-FST-Web-Pro-2026-2027.html
git commit -m "feat(web): deliver professional management interface"
```

## Final Verification Checklist
- [ ] Professional desktop management shell is present.
- [ ] Web visual language is distinct from Android APK.
- [ ] Dashboard uses only derivable metrics.
- [ ] Tables/forms/admin/reports use consistent compact styling.
- [ ] Attendance and optional grade `/20` workflow remains intact.
- [ ] Exactly one `loginTeacher()` remains.
- [ ] Persistent Supabase session restoration remains intact.
- [ ] Admin/Teacher mode visibility remains intact.
- [ ] Sync status is color-only in topbar with accessible text.
- [ ] Green/orange/red/gray/blue sync states are mapped.
- [ ] JavaScript syntax validation passes.
- [ ] Static regression tests pass.
- [ ] End-to-end Supabase behavior is not claimed unless actually executed.
