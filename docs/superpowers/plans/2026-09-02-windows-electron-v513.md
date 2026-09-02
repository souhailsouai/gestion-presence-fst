# Windows Electron V5.13 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the immutable App présence V5.13 renderer as a secure Windows 10/11 x64 Electron application that produces both an NSIS Setup EXE and a portable EXE while continuing to use the production Supabase backend.

**Architecture:** Keep the verified V5.13 standalone HTML unchanged as the renderer asset. Add a small Electron main-process shell with pure security/navigation helpers, Chromium download/print handling, build-time integrity checks, deterministic package metadata, and a Windows GitHub Actions pipeline. No preload API is exposed because V5.13 does not require Node.js capabilities.

**Tech Stack:** Node.js 24, Electron 44.1.1, electron-builder 26.15.3, Node built-in test runner, GitHub Actions `windows-latest`, PowerShell.

**Spec:** `docs/superpowers/specs/2026-09-02-windows-electron-v513-design.md`

## Global Constraints

- Canonical renderer: `Gestion_Presence_FST_TP_MPI_PC_WEB_V5_13.html`.
- Canonical renderer SHA-256: `73daccbc12f1e9d0068a53a5d3f7052f3002a49963ce3842f3fa6040650538e8`.
- Do not modify the V5.13 renderer contents after copying the verified artifact.
- Target Windows 10/11 x64 only.
- Product name: `Gestion Presence FST`.
- Windows application version: `5.13.0`.
- Stable app ID: `tn.fst.gestionpresence`.
- Online-only; no local database, offline queue, synchronization engine, or automatic updater.
- Supabase production project remains `dbslzmvzbxczpqyektpx`.
- No `service_role`, database password, GitHub token, privileged key, PIN, password, access token, or refresh token may be embedded or logged.
- Electron renderer must run with `nodeIntegration:false`, `contextIsolation:true`, `sandbox:true`, `webSecurity:true`, and `allowRunningInsecureContent:false`.
- Production DevTools disabled.
- No unrestricted IPC, filesystem, shell, process, or command-execution API exposed to the renderer.
- First release is unsigned unless an existing Windows code-signing certificate is explicitly supplied; signing is not required for build success.

---

### Task 1: Create the isolated Electron package and lock the V5.13 renderer

**Files:**
- Create: `desktop/windows-electron-v513/package.json`
- Create: `desktop/windows-electron-v513/renderer/Gestion_Presence_FST_TP_MPI_PC_WEB_V5_13.html`
- Create: `desktop/windows-electron-v513/scripts/verify-renderer-integrity.cjs`
- Create: `desktop/windows-electron-v513/test/integrity.test.cjs`
- Create: `desktop/windows-electron-v513/.gitignore`

**Interfaces:**
- Consumes: verified V5.13 artifact from `/mnt/data/Gestion_Presence_FST_TP_MPI_PC_WEB_V5_13.html` during implementation.
- Produces: `verifyRendererIntegrity(rendererPath): string` returning the lowercase SHA-256 and throwing on mismatch.

- [ ] **Step 1: Write the failing integrity test**

```js
// desktop/windows-electron-v513/test/integrity.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { verifyRendererIntegrity, EXPECTED_SHA256 } = require('../scripts/verify-renderer-integrity.cjs');

test('V5.13 renderer matches the canonical SHA-256', () => {
  const renderer = path.join(__dirname, '..', 'renderer', 'Gestion_Presence_FST_TP_MPI_PC_WEB_V5_13.html');
  assert.equal(verifyRendererIntegrity(renderer), EXPECTED_SHA256);
});
```

- [ ] **Step 2: Run the test and confirm RED**

Run: `cd desktop/windows-electron-v513 && node --test test/integrity.test.cjs`
Expected: FAIL because `verify-renderer-integrity.cjs` does not exist.

- [ ] **Step 3: Copy the exact renderer and implement the verifier**

```bash
mkdir -p desktop/windows-electron-v513/renderer desktop/windows-electron-v513/scripts desktop/windows-electron-v513/test
cp /mnt/data/Gestion_Presence_FST_TP_MPI_PC_WEB_V5_13.html desktop/windows-electron-v513/renderer/Gestion_Presence_FST_TP_MPI_PC_WEB_V5_13.html
```

```js
// desktop/windows-electron-v513/scripts/verify-renderer-integrity.cjs
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');

const EXPECTED_SHA256 = '73daccbc12f1e9d0068a53a5d3f7052f3002a49963ce3842f3fa6040650538e8';

function verifyRendererIntegrity(rendererPath) {
  const digest = crypto.createHash('sha256').update(fs.readFileSync(rendererPath)).digest('hex');
  if (digest !== EXPECTED_SHA256) {
    throw new Error(`V5.13 renderer SHA-256 mismatch: ${digest}`);
  }
  return digest;
}

if (require.main === module) {
  const renderer = path.join(__dirname, '..', 'renderer', 'Gestion_Presence_FST_TP_MPI_PC_WEB_V5_13.html');
  console.log(verifyRendererIntegrity(renderer));
}

module.exports = { EXPECTED_SHA256, verifyRendererIntegrity };
```

Create `package.json` with scripts `test`, `verify:renderer`, `start`, `pack:win`, and devDependencies pinned to `electron: 44.1.1` and `electron-builder: 26.15.3`; set `engines.node` to `>=24` and `version` to `5.13.0`.

- [ ] **Step 4: Install dependencies and verify GREEN**

Run: `cd desktop/windows-electron-v513 && npm install && npm run verify:renderer && npm test`
Expected: canonical hash printed and test PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/windows-electron-v513
git commit -m "build: initialize Electron V5.13 package"
```

---

### Task 2: Implement pure security, CSP, and navigation policy

**Files:**
- Create: `desktop/windows-electron-v513/electron/security.cjs`
- Create: `desktop/windows-electron-v513/test/security.test.cjs`

**Interfaces:**
- Produces: `getWebPreferences()`, `CONTENT_SECURITY_POLICY`, `isApprovedExternalUrl(url)`, `isLocalRendererUrl(url)`.
- Approved runtime network origins: `https://dbslzmvzbxczpqyektpx.supabase.co`, `wss://dbslzmvzbxczpqyektpx.supabase.co`, `https://cdn.jsdelivr.net`, `https://cdnjs.cloudflare.com`.
- Approved user-opened external top-level origin: `https://github.com` only; all other top-level HTTP/HTTPS navigation is denied in the Electron window.

- [ ] **Step 1: Write failing security tests**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getWebPreferences,
  CONTENT_SECURITY_POLICY,
  isApprovedExternalUrl
} = require('../electron/security.cjs');

test('renderer has no Node privileges', () => {
  assert.deepEqual(getWebPreferences(), {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    devTools: false
  });
});

test('CSP has no unsafe-eval and allows only required remote libraries/backend', () => {
  assert.equal(CONTENT_SECURITY_POLICY.includes("'unsafe-eval'"), false);
  assert.match(CONTENT_SECURITY_POLICY, /dbslzmvzbxczpqyektpx\.supabase\.co/);
  assert.match(CONTENT_SECURITY_POLICY, /cdn\.jsdelivr\.net/);
  assert.match(CONTENT_SECURITY_POLICY, /cdnjs\.cloudflare\.com/);
});

test('external navigation is narrowly allowlisted', () => {
  assert.equal(isApprovedExternalUrl('https://github.com/souhailsouai/gestion-presence-fst'), true);
  assert.equal(isApprovedExternalUrl('https://example.com'), false);
  assert.equal(isApprovedExternalUrl('javascript:alert(1)'), false);
});
```

- [ ] **Step 2: Run and confirm RED**

Run: `cd desktop/windows-electron-v513 && node --test test/security.test.cjs`
Expected: FAIL because `electron/security.cjs` does not exist.

- [ ] **Step 3: Implement minimal pure policy**

Use this exact CSP basis, retaining `unsafe-inline` only because V5.13 is a single-file renderer with inline style/script:

```js
const CONTENT_SECURITY_POLICY = [
  "default-src 'self' data: blob:",
  "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
  "font-src 'self' data: https://cdnjs.cloudflare.com",
  "img-src 'self' data: blob:",
  "connect-src 'self' https://dbslzmvzbxczpqyektpx.supabase.co wss://dbslzmvzbxczpqyektpx.supabase.co",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'"
].join('; ');
```

`getWebPreferences()` returns exactly the object asserted above. `isApprovedExternalUrl()` parses with `new URL()` and returns true only when `protocol === 'https:' && hostname === 'github.com'`.

- [ ] **Step 4: Run security tests**

Run: `cd desktop/windows-electron-v513 && npm test`
Expected: all integrity and security tests PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/windows-electron-v513/electron desktop/windows-electron-v513/test
git commit -m "feat: add Electron security policy"
```

---

### Task 3: Implement the Electron main process, downloads, printing compatibility, and safe lifecycle

**Files:**
- Create: `desktop/windows-electron-v513/electron/main.cjs`
- Create: `desktop/windows-electron-v513/test/main-contract.test.cjs`

**Interfaces:**
- Consumes: `getWebPreferences`, `CONTENT_SECURITY_POLICY`, `isApprovedExternalUrl` from Task 2.
- Produces: `createMainWindow()`, `installSessionGuards(session)`, `rendererPath`.

- [ ] **Step 1: Write failing contract tests**

Tests import exported pure constants/functions without starting Electron and assert:
- local renderer basename is exactly `Gestion_Presence_FST_TP_MPI_PC_WEB_V5_13.html`;
- main code installs `setWindowOpenHandler` with default `deny`;
- main code registers `will-navigate`, `permission-request-handler`, `onHeadersReceived`, and `will-download` guards;
- no preload path is configured.

- [ ] **Step 2: Run and confirm RED**

Run: `cd desktop/windows-electron-v513 && node --test test/main-contract.test.cjs`
Expected: FAIL because `electron/main.cjs` does not exist.

- [ ] **Step 3: Implement the main process**

`createMainWindow()` must create one `BrowserWindow` with minimum size 1100x700, default size 1440x900, `show:false`, product title `Gestion Presence FST`, and `webPreferences:getWebPreferences()`. Load the renderer by `win.loadFile(rendererPath)` and call `win.show()` only on `ready-to-show`.

`installSessionGuards()` must:
- inject `Content-Security-Policy` through `session.webRequest.onHeadersReceived`;
- deny every permission request with `callback(false)`;
- cancel `will-navigate` for every URL whose protocol is not `file:`;
- use `setWindowOpenHandler` to return `{action:'deny'}` for all popups; if the URL passes `isApprovedExternalUrl`, call `shell.openExternal(url)` before denying;
- listen for `will-download` and show `dialog.showErrorBox('Téléchargement', 'Le téléchargement a échoué.')` only when the final state is neither `completed` nor `cancelled`;
- leave Chromium's normal download destination behavior intact so existing blob and file downloads continue to work;
- not intercept `window.print()`, allowing Chromium's normal print dialog.

On missing renderer file or `loadFile` failure, display `dialog.showErrorBox('Gestion Presence FST', 'Impossible de charger l’application V5.13.')` and quit.

- [ ] **Step 4: Run all Node tests**

Run: `cd desktop/windows-electron-v513 && npm test`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add desktop/windows-electron-v513/electron desktop/windows-electron-v513/test
git commit -m "feat: add secure Electron application shell"
```

---

### Task 4: Add runtime smoke verification without production credentials

**Files:**
- Create: `desktop/windows-electron-v513/test/electron-smoke.cjs`
- Modify: `desktop/windows-electron-v513/package.json`

**Interfaces:**
- Produces npm script `smoke:electron` executed with `electron test/electron-smoke.cjs`.

- [ ] **Step 1: Write the smoke test**

The Electron smoke script must create a hidden BrowserWindow using the same `getWebPreferences()`, load the canonical renderer, then evaluate:

```js
const result = await win.webContents.executeJavaScript(`({
  title: document.title,
  hasNodeRequire: typeof require !== 'undefined',
  hasNodeProcess: typeof process !== 'undefined',
  hasAppRoot: document.documentElement.innerHTML.length > 100000
})`);
```

Assert `hasNodeRequire === false`, `hasNodeProcess === false`, and `hasAppRoot === true`, then exit code 0. This test does not authenticate to production and does not store credentials.

- [ ] **Step 2: Run and confirm the test fails before adding the npm script**

Run: `cd desktop/windows-electron-v513 && npm run smoke:electron`
Expected: FAIL because the script is not defined.

- [ ] **Step 3: Add the script and run GREEN**

Add `"smoke:electron": "electron test/electron-smoke.cjs"` to `package.json`.

Run on a graphical Windows environment: `npm run smoke:electron`
Expected: PASS and process exits 0.

- [ ] **Step 4: Commit**

```bash
git add desktop/windows-electron-v513/package.json desktop/windows-electron-v513/test/electron-smoke.cjs
git commit -m "test: add Electron renderer smoke test"
```

---

### Task 5: Configure deterministic Windows packaging and build metadata

**Files:**
- Modify: `desktop/windows-electron-v513/package.json`
- Create: `desktop/windows-electron-v513/scripts/write-build-metadata.cjs`
- Create: `desktop/windows-electron-v513/scripts/hash-artifacts.cjs`
- Create: `desktop/windows-electron-v513/test/package-config.test.cjs`

**Interfaces:**
- Produces: `dist/Gestion Presence FST Setup.exe`, `dist/Gestion Presence FST Portable.exe`, `dist/SHA256SUMS.txt`, `build-metadata.json`.

- [ ] **Step 1: Write failing package-configuration tests**

Assert package config contains:
- `build.appId === 'tn.fst.gestionpresence'`;
- `build.productName === 'Gestion Presence FST'`;
- `build.asar === true`;
- Windows target list includes both `nsis` x64 and `portable` x64;
- `build.nsis.artifactName === 'Gestion Presence FST Setup.exe'`;
- `build.portable.artifactName === 'Gestion Presence FST Portable.exe'`;
- packaged files include only `electron/**`, `renderer/**`, and `build-metadata.json` plus package metadata required by Electron.

- [ ] **Step 2: Run and confirm RED**

Run: `cd desktop/windows-electron-v513 && node --test test/package-config.test.cjs`
Expected: FAIL because build configuration is not complete.

- [ ] **Step 3: Implement packaging configuration and metadata**

`write-build-metadata.cjs` must first call `verifyRendererIntegrity`, then write:

```json
{
  "baseline": "V5.13",
  "rendererSha256": "73daccbc12f1e9d0068a53a5d3f7052f3002a49963ce3842f3fa6040650538e8",
  "windowsVersion": "5.13.0",
  "buildCommit": "<GITHUB_SHA value or local>"
}
```

At runtime the literal value is read from `process.env.GITHUB_SHA || 'local'`; no placeholder is committed to the generated file.

Set `beforePack` to execute integrity verification through the npm `prepack:win` script. Set `win.verifyUpdateCodeSignature:false` because this first build is not using an updater or mandatory signing.

`hash-artifacts.cjs` must compute lowercase SHA-256 for exactly the two EXE filenames and write `dist/SHA256SUMS.txt`.

- [ ] **Step 4: Run tests and local directory packaging**

Run: `cd desktop/windows-electron-v513 && npm test && npm run verify:renderer && npx electron-builder --win --x64 --dir`
Expected: tests PASS and `dist/win-unpacked/Gestion Presence FST.exe` exists.

- [ ] **Step 5: Commit**

```bash
git add desktop/windows-electron-v513
git commit -m "build: configure Windows Setup and portable packages"
```

---

### Task 6: Add Windows CI build and artifact verification

**Files:**
- Create: `.github/workflows/build-electron-v513.yml`

**Interfaces:**
- Produces GitHub Actions artifact `Gestion-Presence-FST-Electron-v5.13.0` containing both EXEs, `SHA256SUMS.txt`, and `build-metadata.json`.

- [ ] **Step 1: Add a workflow that triggers on `feature/windows-electron-v513`**

Workflow requirements:
- `runs-on: windows-latest`;
- checkout via `actions/checkout@v4`;
- Node 24 via `actions/setup-node@v4`;
- working directory `desktop/windows-electron-v513`;
- `npm ci`;
- `npm run verify:renderer`;
- `npm test`;
- `npm run smoke:electron`;
- `node scripts/write-build-metadata.cjs`;
- `npx electron-builder --win nsis portable --x64 --publish never`;
- `node scripts/hash-artifacts.cjs`;
- PowerShell assertions that both EXEs exist and each is larger than 50 MB;
- upload via `actions/upload-artifact@v4`, `if-no-files-found:error`.

- [ ] **Step 2: Validate workflow syntax locally**

Run: `python -c "import yaml; yaml.safe_load(open('.github/workflows/build-electron-v513.yml', encoding='utf-8')); print('OK')"`
Expected: `OK`.

- [ ] **Step 3: Commit and push**

```bash
git add .github/workflows/build-electron-v513.yml
git commit -m "ci: build Electron V5.13 Windows artifacts"
git push origin feature/windows-electron-v513
```

Expected: push-triggered Windows workflow starts automatically.

---

### Task 7: Verify the Windows artifacts and document credentialed acceptance

**Files:**
- Create: `docs/windows-v513-acceptance.md`

**Interfaces:**
- Consumes: GitHub Actions artifacts from Task 6.
- Produces: verified hashes and a fixed manual acceptance checklist for one Admin account and one Teacher account without storing credentials.

- [ ] **Step 1: Verify the CI run**

Inspect the workflow run and require every step to be successful. Download the artifact ZIP and confirm it contains:
- `Gestion Presence FST Setup.exe`;
- `Gestion Presence FST Portable.exe`;
- `SHA256SUMS.txt`;
- `build-metadata.json`.

- [ ] **Step 2: Verify hashes independently**

On Windows PowerShell:

```powershell
Get-FileHash "Gestion Presence FST Setup.exe" -Algorithm SHA256
Get-FileHash "Gestion Presence FST Portable.exe" -Algorithm SHA256
Get-Content SHA256SUMS.txt
```

Expected: both independently calculated hashes exactly match `SHA256SUMS.txt`.

- [ ] **Step 3: Execute credentialed smoke checks manually without recording credentials**

`docs/windows-v513-acceptance.md` must require a human tester to confirm on Windows 10 or 11 x64:
1. Setup installs and uninstalls successfully.
2. Portable EXE launches without installation.
3. Admin login succeeds using the existing Admin flow.
4. Teacher login succeeds using identifier + six-digit PIN.
5. Planning loads from production Supabase.
6. V5.13 balanced assignment interface is visible to Admin.
7. Attendance and grade permissions match V5.13 rules.
8. Daily student PDF generation succeeds.
9. Native `.docx` generation succeeds and opens in Word 365.
10. A renderer download reaches Windows Downloads normally.
11. `window.print()` opens the Chromium/Windows print dialog.
12. External GitHub link opens in the default browser and never replaces the main app window.
13. With internet disconnected, no local write queue is created; after reconnection, normal V5.13 retry works.
14. DevTools are unavailable in the production package.
15. Renderer console evaluates `typeof require` and `typeof process` as `undefined`.

The checklist stores only PASS/FAIL and tester/date; it must never store credentials, PINs, passwords, access tokens, or refresh tokens.

- [ ] **Step 4: Final verification**

Run in source checkout:

```bash
cd desktop/windows-electron-v513
npm run verify:renderer
npm test
```

Expected: renderer hash equals the canonical V5.13 SHA and all Node tests PASS.

- [ ] **Step 5: Commit acceptance document**

```bash
git add docs/windows-v513-acceptance.md
git commit -m "docs: add Windows V5.13 acceptance checklist"
```

---

## Self-review results

- Spec coverage: renderer integrity, security flags, navigation/popup restrictions, CSP, production Supabase, online-only behavior, downloads, PDF/Word/printing compatibility, Setup + portable packaging, traceability metadata, SHA-256 output, Windows CI, and credentialed acceptance are all mapped to tasks above.
- Placeholder scan: no implementation placeholder remains; generated `buildCommit` is explicitly defined as `process.env.GITHUB_SHA || 'local'`.
- Type/interface consistency: Tasks 2 and 3 share `getWebPreferences`, `CONTENT_SECURITY_POLICY`, and `isApprovedExternalUrl`; Task 5 consumes Task 1's `verifyRendererIntegrity` without renaming.
- Scope remains one subsystem: the Windows Electron shell and packaging only; no business-rule changes are included.
