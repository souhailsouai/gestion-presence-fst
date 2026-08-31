# Web Standalone Professional Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fragile patched Web runtime with one professional, directly-openable standalone HTML application that preserves Supabase-backed teacher/admin attendance workflows and passes real browser startup tests.

**Architecture:** Build from a clean semantic HTML template plus focused browser modules registered under one `FSTApp` namespace. Keep Supabase as the single source of truth, keep authoritative writes online-only, and bundle all required CSS/JavaScript/vendor assets into one final `.html` file. The historical monolith and patch files remain reference-only during migration and are removed from the release path once parity tests pass.

**Tech Stack:** HTML5, CSS3, browser JavaScript, Supabase JS 2.57.4, jsPDF 4.2.1, jsPDF-AutoTable 5.0.8, Node.js 22 contract tests, Playwright/Chromium smoke tests, Python 3.12 release bundler, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-31-web-standalone-professional-rebuild-design.md`

## Global Constraints

- Primary deliverable: exactly one directly downloadable `Gestion-Presence-FST-Web-2026-2027.html`; no ZIP required by the user.
- Academic year remains exactly `2026/2027`.
- Production Supabase project remains `https://dbslzmvzbxczpqyektpx.supabase.co` using the existing browser publishable key only.
- Only teachers and administrators authenticate; students have no application accounts.
- Authentication is identifier + password/PIN only; no MFA/TOTP UI, factor API, challenge flow, or AAL2 business-write requirement.
- Attendance saves remain atomic through `save_attendance_sheet(session_id, expected_revision, operation_id, records[])` and must surface `VERSION_CONFLICT` rather than overwrite silently.
- Authoritative business mutations are online-only; do not queue mutation replay in localStorage.
- No service-role secret, database admin credential, or RLS bypass may exist in the browser source.
- Final HTML must not require external JavaScript, icon, or CSS CDNs for startup/rendering.
- Production data and schema are preserved; this rebuild does not require destructive database migration.
- Every production change follows TDD: failing regression/contract test first, then minimal implementation, then full verification.

---

### Task 1: Reproduce the broken standalone startup with a real browser test

**Files:**
- Create: `package.json`
- Create: `tests/web/standalone-browser-smoke.test.cjs`
- Modify: `.github/workflows/build-web.yml`

**Interfaces:**
- Consumes: generated artifact `dist/web/Gestion-Presence-FST-Web-2026-2027.html`.
- Produces: executable smoke test that exits non-zero on blank page, uncaught startup errors, or missing login controls.

- [ ] **Step 1: Write the browser regression test before changing the application**

Create `package.json` with Playwright as the only Web-test dependency:

```json
{
  "private": true,
  "devDependencies": {
    "playwright": "1.55.0"
  }
}
```

Create `tests/web/standalone-browser-smoke.test.cjs`:

```js
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  const artifact = path.resolve('dist/web/Gestion-Presence-FST-Web-2026-2027.html');
  await page.goto(pathToFileURL(artifact).href, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(750);
  assert.equal(errors.length, 0, `startup errors: ${errors.join(' | ')}`);
  assert.equal(await page.locator('[data-testid="login-identifier"]').count(), 1);
  assert.equal(await page.locator('[data-testid="login-secret"]').count(), 1);
  assert.equal(await page.locator('[data-testid="login-submit"]').count(), 1);
  assert.equal(await page.locator('body').evaluate(el => el.innerText.trim().length > 40), true);
  await browser.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 2: Build the current artifact and run the test to establish RED**

Run:

```bash
python scripts/build_online_web.py
python scripts/build_single_file_release.py
mkdir -p dist/web
cp web/index.html dist/web/Gestion-Presence-FST-Web-2026-2027.html
npm install
npx playwright install chromium
node tests/web/standalone-browser-smoke.test.cjs
```

Expected: FAIL because the current artifact does not satisfy the new deterministic login/startup contract or emits runtime errors.

- [ ] **Step 3: Add CI installation only; do not weaken the failing assertion**

Modify `.github/workflows/build-web.yml` to set up Node 22, run `npm ci` after a lockfile exists, install Chromium with `npx playwright install --with-deps chromium`, and execute the browser smoke test after the final artifact is copied to `dist/web`.

- [ ] **Step 4: Commit the regression harness while it documents the defect**

```bash
git add package.json package-lock.json tests/web/standalone-browser-smoke.test.cjs .github/workflows/build-web.yml
git commit -m "test(web): reproduce standalone browser startup"
```

---

### Task 2: Establish one deterministic application shell and professional UI system

**Files:**
- Create: `web/index.template.html`
- Create: `web/styles.css`
- Create: `web/ui.js`
- Create: `web/app-shell.js`
- Create: `tests/web/app-shell.test.cjs`
- Create: `tests/web/ui-contract.test.cjs`

**Interfaces:**
- Consumes: browser DOM and later `FSTApp.auth.restoreSession()`.
- Produces: `window.FSTApp`, `FSTApp.boot()`, `FSTApp.ui.renderLogin()`, `FSTApp.ui.renderFatal(error)`, `FSTApp.ui.setBusy(button, busy)`, and a stable semantic DOM contract.

- [ ] **Step 1: Write failing structural tests**

`tests/web/app-shell.test.cjs` must assert the source contains exactly one `FSTApp.boot` definition, a `DOMContentLoaded` listener, one boot guard, and a fatal error path:

```js
const fs = require('node:fs');
const assert = require('node:assert/strict');
const src = fs.readFileSync('web/app-shell.js', 'utf8');
assert.equal((src.match(/FSTApp\.boot\s*=/g) || []).length, 1);
assert.match(src, /DOMContentLoaded/);
assert.match(src, /bootStarted/);
assert.match(src, /renderFatal/);
```

`tests/web/ui-contract.test.cjs` must assert the template exposes unique test IDs `login-identifier`, `login-secret`, `login-submit`, `app-root`, `status-region`, and contains no Font Awesome/CDN stylesheet.

- [ ] **Step 2: Run tests and verify RED**

```bash
node tests/web/app-shell.test.cjs
node tests/web/ui-contract.test.cjs
```

Expected: FAIL because the new files do not exist.

- [ ] **Step 3: Implement the semantic template and restrained institutional styling**

`web/index.template.html` contains only semantic markup placeholders and local build markers:

```html
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Gestion de présence — FST</title>
  <!-- FST_STYLES -->
</head>
<body>
  <div id="app-root" data-testid="app-root"></div>
  <div id="status-region" data-testid="status-region" role="status" aria-live="polite"></div>
  <!-- FST_VENDOR -->
  <!-- FST_MODULES -->
</body>
</html>
```

`web/styles.css` defines one professional palette, focus states, compact tables, responsive navigation, loading/disabled controls, error/success/conflict banners, and no dependency on external fonts/icons.

- [ ] **Step 4: Implement one global namespace and deterministic boot**

`web/app-shell.js` starts with:

```js
(() => {
  const FSTApp = window.FSTApp = window.FSTApp || {};
  let bootStarted = false;
  FSTApp.config = Object.freeze({
    academicYear: '2026/2027',
    supabaseUrl: 'https://dbslzmvzbxczpqyektpx.supabase.co',
    supabaseKey: 'sb_publishable_wKwmPnXS_Q7REGU57hTIyw_eqxhIXLT'
  });
  FSTApp.boot = async function boot() {
    if (bootStarted) return;
    bootStarted = true;
    try {
      const session = await FSTApp.auth.restoreSession();
      if (session) await FSTApp.ui.renderApplication(session);
      else FSTApp.ui.renderLogin();
    } catch (error) {
      FSTApp.ui.renderFatal(error);
    }
  };
  document.addEventListener('DOMContentLoaded', () => FSTApp.boot(), { once: true });
})();
```

- [ ] **Step 5: Make tests GREEN**

```bash
node tests/web/app-shell.test.cjs
node tests/web/ui-contract.test.cjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/index.template.html web/styles.css web/ui.js web/app-shell.js tests/web/app-shell.test.cjs tests/web/ui-contract.test.cjs
git commit -m "feat(web): add deterministic professional app shell"
```

---

### Task 3: Replace layered authentication with one Supabase auth implementation

**Files:**
- Create: `web/api.js`
- Create: `web/auth.js`
- Create: `tests/web/auth.test.cjs`
- Create: `tests/web/api-contract.test.cjs`

**Interfaces:**
- Consumes: `FSTApp.config`, `window.supabase.createClient`.
- Produces: `FSTApp.api.client()`, `FSTApp.api.invokePinLogin(identifier, secret)`, `FSTApp.api.profile()`, `FSTApp.auth.login({identifier, secret, requestedMode})`, `FSTApp.auth.restoreSession()`, `FSTApp.auth.logout()`.

- [ ] **Step 1: Write failing auth contracts**

`tests/web/auth.test.cjs` must verify identifier normalization, no MFA vocabulary/API, one login implementation, and server-confirmed role gating:

```js
const fs = require('node:fs');
const assert = require('node:assert/strict');
const src = fs.readFileSync('web/auth.js', 'utf8');
assert.equal((src.match(/FSTApp\.auth\.login\s*=/g) || []).length, 1);
assert.doesNotMatch(src, /mfa|totp|challengeAndVerify|auth\.mfa/i);
assert.match(src, /requestedMode === 'admin'/);
assert.match(src, /profile\.is_admin|profile\.role/);
```

`tests/web/api-contract.test.cjs` must require `pin-login`, `setSession`, normalized profile handling, explicit 401 mapping, and no service-role key markers.

- [ ] **Step 2: Run tests and verify RED**

```bash
node tests/web/auth.test.cjs
node tests/web/api-contract.test.cjs
```

Expected: FAIL.

- [ ] **Step 3: Implement one Supabase client and API error normalizer**

`FSTApp.api.client()` lazily creates exactly one client. `invokePinLogin()` calls the existing Edge Function and returns `{ access_token, refresh_token }`; the API module then calls `client.auth.setSession(...)`. `profile()` accepts either single-object or one-row-array responses and rejects ambiguous/missing profiles.

Use a normalized error shape:

```js
FSTApp.api.normalizeError = function normalizeError(error) {
  const message = String(error?.message || error || 'Erreur inconnue');
  if (/401|jwt|session/i.test(message)) return { code: 'SESSION_EXPIRED', message: 'Session expirée. Reconnectez-vous.' };
  if (/network|fetch|offline/i.test(message)) return { code: 'NETWORK', message: 'Connexion Internet requise.' };
  return { code: error?.code || 'API_ERROR', message };
};
```

- [ ] **Step 4: Implement login/session restore without MFA**

`FSTApp.auth.login()` validates identifier/secret, obtains the server session, loads the profile, and rejects admin mode unless the server profile confirms admin privileges. `restoreSession()` obtains the Supabase session and profile once; `logout()` signs out then clears only UI/session state.

- [ ] **Step 5: Make auth tests GREEN**

```bash
node tests/web/auth.test.cjs
node tests/web/api-contract.test.cjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/api.js web/auth.js tests/web/auth.test.cjs tests/web/api-contract.test.cjs
git commit -m "feat(web): unify Supabase authentication"
```

---

### Task 4: Implement online-only attendance with revision and idempotency protection

**Files:**
- Create: `web/attendance.js`
- Create: `tests/web/attendance.test.cjs`
- Modify: `web/ui.js`

**Interfaces:**
- Consumes: `FSTApp.api.client()`, authenticated profile/session, existing Supabase tables and RPC.
- Produces: `FSTApp.attendance.loadSession(id)`, `FSTApp.attendance.buildSavePayload(state)`, `FSTApp.attendance.save(state)`, conflict/online UI states.

- [ ] **Step 1: Write failing attendance contracts**

Test that save payload includes `session_id`, `expected_revision`, unique `operation_id`, and `records`; test that `VERSION_CONFLICT` maps to an explicit conflict result; test that localStorage is not used as a mutation queue.

```js
const fs = require('node:fs');
const assert = require('node:assert/strict');
const src = fs.readFileSync('web/attendance.js', 'utf8');
assert.match(src, /save_attendance_sheet/);
assert.match(src, /expected_revision/);
assert.match(src, /operation_id/);
assert.match(src, /crypto\.randomUUID/);
assert.match(src, /VERSION_CONFLICT/);
assert.doesNotMatch(src, /syncQueue|QUEUE_KEY|localStorage\.setItem\([^)]*attendance/i);
```

- [ ] **Step 2: Run and verify RED**

```bash
node tests/web/attendance.test.cjs
```

Expected: FAIL.

- [ ] **Step 3: Implement authoritative online-only save**

Before save, require `navigator.onLine`. Call:

```js
await FSTApp.api.client().rpc('save_attendance_sheet', {
  session_id: state.sessionId,
  expected_revision: state.revision,
  operation_id: crypto.randomUUID(),
  records: state.records
});
```

On `VERSION_CONFLICT`, return `{ ok:false, conflict:true }`, lock the save button, show “Cette feuille a été modifiée ailleurs. Rechargez les données avant de continuer.”, and provide a reload action. Never silently retry with a newer revision.

- [ ] **Step 4: Implement UI states**

`web/ui.js` must render distinct states for saving, success, offline, session-expired, permission-denied, validation error, and revision conflict. Buttons remain disabled while a request is pending.

- [ ] **Step 5: Make test GREEN**

```bash
node tests/web/attendance.test.cjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/attendance.js web/ui.js tests/web/attendance.test.cjs
git commit -m "feat(web): add conflict-safe online attendance"
```

---

### Task 5: Migrate teacher/admin navigation and authorized management flows

**Files:**
- Create: `web/administration.js`
- Create: `tests/web/role-gating.test.cjs`
- Create: `tests/web/management-contract.test.cjs`
- Modify: `web/ui.js`
- Modify: `web/app-shell.js`

**Interfaces:**
- Consumes: authenticated profile, `FSTApp.api`, attendance module.
- Produces: role-aware navigation; teacher views for presence/classes/timetable/reports/account; admin-only teacher/student/class/timetable administration supported by existing backend authorization.

- [ ] **Step 1: Write failing role-gating test**

The test must assert there is one role predicate sourced from the loaded profile and no DOM-only privilege decision:

```js
const fs = require('node:fs');
const assert = require('node:assert/strict');
const src = fs.readFileSync('web/administration.js', 'utf8');
assert.match(src, /isAdminProfile/);
assert.match(src, /profile/);
assert.doesNotMatch(src, /requestedMode.*return true/);
```

- [ ] **Step 2: Write management contract test**

Require explicit server calls for teacher directory, classes, students, timetable, and admin teacher mutations already exposed by the backend. Require safe DOM rendering helper use for user-controlled strings.

- [ ] **Step 3: Run and verify RED**

```bash
node tests/web/role-gating.test.cjs
node tests/web/management-contract.test.cjs
```

Expected: FAIL.

- [ ] **Step 4: Implement role-aware navigation and management views**

Use one navigation model:

```js
const base = ['presence', 'classes', 'timetable', 'reports', 'account'];
const admin = ['teachers', 'students', 'administration'];
return FSTApp.auth.isAdminProfile(profile) ? [...base, ...admin] : base;
```

Every admin mutation must also rely on the existing server-side authorization; hiding a button is not treated as security.

- [ ] **Step 5: Make tests GREEN**

```bash
node tests/web/role-gating.test.cjs
node tests/web/management-contract.test.cjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/administration.js web/ui.js web/app-shell.js tests/web/role-gating.test.cjs tests/web/management-contract.test.cjs
git commit -m "feat(web): migrate authorized management flows"
```

---

### Task 6: Migrate statistics and PDF reports without external runtime dependencies

**Files:**
- Create: `web/reports.js`
- Create: `tests/web/reports.test.cjs`
- Modify: `web/ui.js`

**Interfaces:**
- Consumes: authenticated report/attendance data, embedded `window.jspdf` and AutoTable plugin.
- Produces: report summaries, statistics views, grade-only behavior where applicable, and PDF export.

- [ ] **Step 1: Write failing report parity tests**

Require the final module to expose:

```js
FSTApp.reports.buildAttendanceSummary
FSTApp.reports.buildGradeSummary
FSTApp.reports.exportAttendancePdf
FSTApp.reports.exportStatisticsPdf
```

Also assert `Lecture seule`, `Statistiques et graphiques`, `Répartition des notes`, and `Comparaison par module` remain represented where the existing product requires them.

- [ ] **Step 2: Run and verify RED**

```bash
node tests/web/reports.test.cjs
```

Expected: FAIL.

- [ ] **Step 3: Port only proven logic from `web/statistics.js` and `web/report-pdf.js`**

Move calculations/export behavior into `web/reports.js`; do not copy global overrides. PDF code must fail visibly with `Moteur PDF indisponible` if embedded jsPDF is missing rather than crashing silently.

- [ ] **Step 4: Make report tests GREEN plus existing PDF tests**

```bash
node tests/web/reports.test.cjs
node tests/web/pdf-bundle.test.cjs
node tests/web/pdf-engine-smoke.test.cjs
node tests/web/report-grade-only.test.cjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/reports.js web/ui.js tests/web/reports.test.cjs
git commit -m "feat(web): migrate reports and statistics"
```

---

### Task 7: Replace the patch-based build with deterministic single-file bundling

**Files:**
- Rewrite: `scripts/build_online_web.py`
- Rewrite: `scripts/build_single_file_release.py`
- Modify: `tests/web/build-web.test.cjs`
- Modify: `tests/web/final-bundle-order.postbuild.cjs`
- Create: `tests/web/final-artifact-security.test.cjs`

**Interfaces:**
- Consumes: `web/index.template.html`, `web/styles.css`, new Web modules, vendored Supabase/jsPDF libraries.
- Produces: `web/index.html` and `dist/web/Gestion-Presence-FST-Web-2026-2027.html` with no external runtime dependencies.

- [ ] **Step 1: Write failing build tests before changing builders**

The tests must reject the old patch path and duplicate runtime layers:

```js
const fs = require('node:fs');
const assert = require('node:assert/strict');
const builder = fs.readFileSync('scripts/build_online_web.py', 'utf8');
assert.doesNotMatch(builder, /web-superadmin\.patch/);
assert.doesNotMatch(builder, /git.*apply/);
```

Post-build test requirements:

```js
assert.equal((html.match(/FSTApp\.auth\.login\s*=/g) || []).length, 1);
assert.equal((html.match(/FSTApp\.auth\.restoreSession\s*=/g) || []).length, 1);
assert.equal((html.match(/FSTApp\.boot\s*=/g) || []).length, 1);
assert.doesNotMatch(html, /<script[^>]+src=/i);
assert.doesNotMatch(html, /<link[^>]+(?:cdnjs|jsdelivr|unpkg)/i);
assert.doesNotMatch(html, /auth\.mfa|challengeAndVerify|totp/i);
```

- [ ] **Step 2: Run tests and verify RED against the current patch build**

```bash
node tests/web/build-web.test.cjs
node tests/web/final-artifact-security.test.cjs
```

Expected: FAIL because the build still depends on the historical patch pipeline.

- [ ] **Step 3: Rewrite `build_online_web.py` as a source validator/stager**

It validates all required source files and vendor files, but never mutates `web/index.template.html` and never calls `git apply`.

- [ ] **Step 4: Rewrite `build_single_file_release.py` as deterministic placeholder bundler**

Read the template, inline `styles.css` into `<!-- FST_STYLES -->`, inline vendored Supabase/jsPDF into `<!-- FST_VENDOR -->`, then inline modules in exact order:

```text
ui.js
api.js
auth.js
attendance.js
administration.js
reports.js
app-shell.js
```

Write `web/index.html`, then copy it to `dist/web/Gestion-Presence-FST-Web-2026-2027.html` and generate `SHA256SUMS.txt`.

- [ ] **Step 5: Make structural build tests GREEN**

```bash
python scripts/build_online_web.py
python scripts/build_single_file_release.py
node tests/web/build-web.test.cjs
node tests/web/final-bundle-order.postbuild.cjs
node tests/web/final-artifact-security.test.cjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/build_online_web.py scripts/build_single_file_release.py tests/web/build-web.test.cjs tests/web/final-bundle-order.postbuild.cjs tests/web/final-artifact-security.test.cjs
git commit -m "build(web): replace historical patch pipeline"
```

---

### Task 8: Cut CI over to the rebuilt artifact and remove obsolete runtime layers from release use

**Files:**
- Modify: `.github/workflows/build-web.yml`
- Modify or retire from release path: `web/online-runtime.js`
- Modify or retire from release path: `web/online-fixes.js`
- Modify or retire from release path: `web/security-v2.js`
- Modify or retire from release path: `web/no-mfa.js`
- Modify or retire from release path: `web/access-control.js`
- Modify or retire from release path: `web/attendance-policy.js`
- Modify or retire from release path: `web/session-permissions.js`
- Modify or retire from release path: `web/session-editing.js`
- Modify or retire from release path: `web/statistics.js`
- Modify or retire from release path: `web/report-pdf.js`
- Modify: existing `tests/web/*.test.cjs` contracts that intentionally reference the retired architecture.

**Interfaces:**
- Consumes: all new Web modules and tests.
- Produces: one CI artifact named `Gestion-Presence-FST-Web-v2.1.0` containing the standalone HTML and checksum metadata; no release build references obsolete override layers.

- [ ] **Step 1: Update legacy tests to test behavior, not retired filenames**

Keep coverage for RLS-aware access, attendance policy, PDF, statistics, MFA absence, and online-only behavior, but point assertions to the new authoritative modules.

- [ ] **Step 2: Run the entire test set before removing release references**

```bash
for test in tests/web/*.test.cjs; do node "$test"; done
```

Expected: any stale test naming retired files must fail until updated; functional contracts must remain.

- [ ] **Step 3: Remove obsolete files from the bundler/workflow and delete only when no test/release reference remains**

Search before deletion:

```bash
grep -R "online-runtime\|online-fixes\|security-v2\|no-mfa\|access-control\|attendance-policy\|session-permissions\|session-editing\|statistics.js\|report-pdf.js" web scripts tests .github || true
```

Delete obsolete files only after the search shows no required execution path depends on them. Preserve the historical root HTML as reference until final parity verification is complete.

- [ ] **Step 4: Update Web workflow artifact packaging**

The workflow sequence becomes:

```text
checkout -> Python 3.12 -> Node 22 -> npm ci -> Playwright Chromium
-> JS/unit contracts -> build -> post-build/security checks
-> file:// Chromium smoke -> sha256sum --check -> upload
```

Upload `dist/web/Gestion-Presence-FST-Web-2026-2027.html` and `dist/web/SHA256SUMS.txt` only; users receive the `.html` directly from the downloaded artifact contents, not a second manually-created ZIP deliverable.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(web): cut release over to rebuilt standalone app"
```

---

### Task 9: Final verification against the exact user-reported failure and release artifact

**Files:**
- Verify only; no production changes unless a failing test starts a new RED/GREEN cycle.

**Interfaces:**
- Consumes: final generated HTML and GitHub Actions workflow.
- Produces: evidence that the standalone HTML opens, renders, and preserves required contracts.

- [ ] **Step 1: Run full local-equivalent verification**

```bash
npm ci
npx playwright install chromium
for test in tests/web/*.test.cjs; do node "$test"; done
python scripts/build_online_web.py
python scripts/build_single_file_release.py
node tests/web/final-bundle-order.postbuild.cjs
node tests/web/final-artifact-security.test.cjs
node tests/web/standalone-browser-smoke.test.cjs
sha256sum --check dist/web/SHA256SUMS.txt
```

Expected: every command exits 0.

- [ ] **Step 2: Verify no forbidden release markers remain**

```bash
! grep -Eiq "auth\.mfa|challengeAndVerify|totp|web-superadmin\.patch|cdn\.jsdelivr|cdnjs\.cloudflare|<script[^>]+src=" dist/web/Gestion-Presence-FST-Web-2026-2027.html
```

Expected: exit 0.

- [ ] **Step 3: Verify required release markers exactly once where canonical**

```bash
grep -Fq "save_attendance_sheet" dist/web/Gestion-Presence-FST-Web-2026-2027.html
grep -Fq "VERSION_CONFLICT" dist/web/Gestion-Presence-FST-Web-2026-2027.html
grep -Fq "2026/2027" dist/web/Gestion-Presence-FST-Web-2026-2027.html
```

Expected: exit 0.

- [ ] **Step 4: Push and require a fresh successful GitHub Actions Web run**

Do not claim completion from local/static checks alone. The fresh workflow must show successful syntax/contracts, build, artifact-security checks, Chromium `file://` smoke, checksum verification, and artifact upload.

- [ ] **Step 5: Download the fresh CI artifact, extract only the `.html`, and deliver that exact file to the user**

Record the workflow run ID, head SHA, artifact ID, artifact digest, and standalone HTML SHA-256 in the completion note. Do not substitute any older v2.0.0/v2.0.1 HTML.

---

## Self-review

- Spec coverage: startup reliability, single-file delivery, Supabase preservation, teacher/admin-only auth, no MFA, online-only authoritative writes, conflict-safe attendance, professional responsive UI, reports/statistics/PDF, no CDN runtime dependency, browser smoke testing, deterministic bundling, and checksum verification are each mapped to explicit tasks.
- Placeholder scan: no TBD/TODO/“implement later” steps remain.
- Interface consistency: all modules register under the same `window.FSTApp`; canonical auth names are `FSTApp.auth.login`, `FSTApp.auth.restoreSession`, `FSTApp.auth.logout`; attendance saves use `FSTApp.attendance.save`; UI startup enters only through `FSTApp.boot()`.
