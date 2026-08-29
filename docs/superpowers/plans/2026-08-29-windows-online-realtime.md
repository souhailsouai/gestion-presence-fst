# Windows Online Realtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a strictly online Windows client that loads the same production GitHub Pages HTML as the browser, persists pedagogical data only in Supabase, and receives live updates through Supabase Realtime.

**Architecture:** `web/index.html` is the single production Web/Windows interface. Windows is a thin .NET 8 WPF/WebView2 host that navigates to `https://souhailsouai.github.io/gestion-presence-fst/`; pedagogical writes go directly to Supabase and are never queued locally. Supabase Realtime publishes `classes`, `students`, `sessions`, and `attendance`; after reconnect or channel failure the client performs an authoritative Supabase refresh without manual page reload.

**Tech Stack:** HTML/CSS/JavaScript, Supabase JS v2, Supabase Postgres/RLS/Realtime, GitHub Pages, GitHub Actions, .NET 8 WPF, WebView2, xUnit, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-08-29-windows-online-realtime-design.md`

## Global Constraints

- Production is strictly online; no SQLite pedagogical cache, `sync_queue`, `sync_conflicts`, deferred mutation, offline replay, or local-vs-remote conflict workflow.
- Production Web and Windows use the same deployed `web/index.html`.
- Windows production URL is exactly `https://souhailsouai.github.io/gestion-presence-fst/`.
- GitHub Pages deploys only from `main`; feature branches may test but must not publish production.
- Realtime publication is limited to `classes`, `students`, `sessions`, and `attendance`.
- Supabase remains the single source of truth; RLS and existing server-side Admin/Super Admin protections remain unchanged.
- Frontend code may contain only the existing public/publishable Supabase key; never embed `service_role` or another server secret.
- A failed write must not show success; the UI must refresh authoritative server state after an error.
- Offline state must display `Connexion Internet requise` and block writes.
- Date states are: gray = available/no confirmed session; orange = selected/unconfirmed; blue = confirmed; green = completed; red = application/server error requiring attention.
- Persistent Supabase session restoration remains supported, but role/profile restoration must not rely on stale local profile data when the server cannot be reached.
- Preserve the approved functional interface and existing teacher/Admin/Super Admin flows.

---

### Task 1: Materialize the approved functional HTML as the canonical Web artifact

**Files:**
- Create: `web/index.html`
- Delete: `scripts/build_shared_html.py`
- Create: `tests/web/baseline.test.cjs`

**Interfaces:**
- Consumes: approved HTML delta stored on remote branch `feature/windows-offline-sync` as `scripts/web-superadmin.patch.part1` and `scripts/web-superadmin.patch.part2`.
- Produces: committed `web/index.html` containing the approved old functional UI, Super Admin protections, teacher directory, persistent session logic, and 2026/2027 constants.

- [ ] **Step 1: Write the failing baseline test**

```js
// tests/web/baseline.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const htmlPath = path.join(__dirname, '..', '..', 'web', 'index.html');

test('canonical approved web interface exists', () => {
  assert.equal(fs.existsSync(htmlPath), true);
  const html = fs.readFileSync(htmlPath, 'utf8');
  for (const marker of [
    'Gestion Présence FST — 2026/2027',
    'teacher_directory',
    'admin-teacher',
    'restorePersistentSession',
    'ACTIVE_MODE_KEY',
    'loginTeacher',
    "const ACADEMIC_YEAR = '2026/2027'"
  ]) assert.match(html, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/web/baseline.test.cjs`

Expected: FAIL because `web/index.html` does not exist on this branch.

- [ ] **Step 3: Reconstruct the exact approved HTML once, then commit it directly**

Run from a normal git worktree:

```bash
git fetch origin feature/windows-offline-sync
mkdir -p web
cp gestion_presence_tp_theme_institutionnel.html web/index.html
git show origin/feature/windows-offline-sync:scripts/web-superadmin.patch.part1 > /tmp/web-superadmin.part1
git show origin/feature/windows-offline-sync:scripts/web-superadmin.patch.part2 > /tmp/web-superadmin.part2
cat /tmp/web-superadmin.part1 /tmp/web-superadmin.part2 > /tmp/web-superadmin.patch.gz.b64
python - <<'PY'
from pathlib import Path
import base64, gzip
src = Path('/tmp/web-superadmin.patch.gz.b64').read_text().strip()
assert len(src) == 12544
Path('/tmp/web-superadmin.patch').write_bytes(gzip.decompress(base64.b64decode(src)))
PY
git apply -p0 --whitespace=nowarn /tmp/web-superadmin.patch
rm scripts/build_shared_html.py
```

Verify these markers in the resulting committed file:

```bash
grep -n "teacher_directory\|restorePersistentSession\|admin-teacher\|2026/2027" web/index.html
```

- [ ] **Step 4: Run the baseline test and verify GREEN**

Run: `node --test tests/web/baseline.test.cjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/index.html tests/web/baseline.test.cjs scripts/build_shared_html.py
git commit -m "feat: establish canonical approved web interface"
```

---

### Task 2: Add testable online-only persistence and date-state primitives

**Files:**
- Create: `web/online-core.js`
- Create: `tests/web/online-core.test.cjs`
- Modify: `web/index.html`

**Interfaces:**
- Produces: `window.FSTOnlineCore.REALTIME_TABLES`, `getSessionDateState(input)`, `createOnlineRepository(options)`, and `registerRealtimeTables(channel, onChange)`.
- `createOnlineRepository({ client, isOnline })` returns `{ upsert(table, rows), remove(table, id) }`, each resolving to `{ ok, data?, error?, offline? }`.

- [ ] **Step 1: Write failing unit tests**

```js
// tests/web/online-core.test.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../../web/online-core.js');

test('date-state priority is red green blue orange gray', () => {
  assert.equal(core.getSessionDateState({ error:true, completed:true, confirmed:true, selected:true }), 'red');
  assert.equal(core.getSessionDateState({ completed:true, confirmed:true, selected:true }), 'green');
  assert.equal(core.getSessionDateState({ confirmed:true, selected:true }), 'blue');
  assert.equal(core.getSessionDateState({ selected:true }), 'orange');
  assert.equal(core.getSessionDateState({}), 'gray');
});

test('only four pedagogical tables are accepted', () => {
  assert.deepEqual(core.REALTIME_TABLES, ['classes','students','sessions','attendance']);
});

test('offline repository refuses a write without calling Supabase', async () => {
  let calls = 0;
  const client = { from(){ calls++; throw new Error('must not be called'); } };
  const repo = core.createOnlineRepository({ client, isOnline: () => false });
  const result = await repo.upsert('classes', [{id:'c1'}]);
  assert.equal(result.ok, false);
  assert.equal(result.offline, true);
  assert.equal(calls, 0);
});

test('online repository returns success only after Supabase accepts upsert', async () => {
  const client = { from(table){
    assert.equal(table, 'students');
    return { upsert(rows){
      assert.deepEqual(rows, [{id:'s1'}]);
      return { select: async () => ({ data: rows, error: null }) };
    }};
  }};
  const repo = core.createOnlineRepository({ client, isOnline: () => true });
  assert.deepEqual(await repo.upsert('students', [{id:'s1'}]), {ok:true,data:[{id:'s1'}]});
});

test('realtime registers all four tables', () => {
  const seen = [];
  const channel = { on(kind, filter){ seen.push([kind, filter.table]); return this; } };
  core.registerRealtimeTables(channel, () => {});
  assert.deepEqual(seen, core.REALTIME_TABLES.map(t => ['postgres_changes', t]));
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/web/online-core.test.cjs`

Expected: FAIL because `web/online-core.js` does not exist.

- [ ] **Step 3: Implement the primitives**

```js
// web/online-core.js
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FSTOnlineCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  const REALTIME_TABLES = Object.freeze(['classes','students','sessions','attendance']);

  function getSessionDateState({ error=false, completed=false, confirmed=false, selected=false } = {}) {
    if (error) return 'red';
    if (completed) return 'green';
    if (confirmed) return 'blue';
    if (selected) return 'orange';
    return 'gray';
  }

  function ensureTable(table) {
    if (!REALTIME_TABLES.includes(table)) throw new Error(`Unsupported pedagogical table: ${table}`);
  }

  function createOnlineRepository({ client, isOnline }) {
    return {
      async upsert(table, rows) {
        ensureTable(table);
        if (!isOnline()) return { ok:false, offline:true, error:new Error('Connexion Internet requise') };
        const { data, error } = await client.from(table).upsert(rows).select();
        return error ? { ok:false, error } : { ok:true, data:data || [] };
      },
      async remove(table, id) {
        ensureTable(table);
        if (!isOnline()) return { ok:false, offline:true, error:new Error('Connexion Internet requise') };
        const { error } = await client.from(table).delete().eq('id', id);
        return error ? { ok:false, error } : { ok:true };
      }
    };
  }

  function registerRealtimeTables(channel, onChange) {
    for (const table of REALTIME_TABLES) {
      channel = channel.on('postgres_changes', { event:'*', schema:'public', table }, onChange);
    }
    return channel;
  }

  return { REALTIME_TABLES, getSessionDateState, createOnlineRepository, registerRealtimeTables };
});
```

Add before the application inline script in `web/index.html`:

```html
<script src="./online-core.js"></script>
```

- [ ] **Step 4: Run GREEN**

Run: `node --test tests/web/online-core.test.cjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/online-core.js web/index.html tests/web/online-core.test.cjs
git commit -m "test: add online persistence primitives"
```

---

### Task 3: Remove pedagogical offline cache/queue and make loading authoritative

**Files:**
- Modify: `web/index.html`
- Create: `tests/web/online-architecture.test.cjs`

**Interfaces:**
- Consumes: `FSTOnlineCore.createOnlineRepository`.
- Produces: `onlineRepository`, `fetchRemoteData()`, and `loadData()` with no local pedagogical fallback.

- [ ] **Step 1: Write the failing architecture test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync('web/index.html','utf8');

test('production HTML contains no offline pedagogical queue/cache', () => {
  for (const forbidden of [
    'attendanceSupabaseCache_',
    'attendanceSupabase_syncQueue',
    'queueSync(',
    'saveCache()',
    'loadCache()',
    'syncQueue',
    'modifications en attente',
    'cache local'
  ]) assert.equal(html.includes(forbidden), false, forbidden);
});

test('frontend contains no server secret', () => {
  assert.equal(/service_role|sb_secret_/i.test(html), false);
  assert.match(html, /sb_publishable_/);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/web/online-architecture.test.cjs`

Expected: FAIL on the current cache/queue symbols.

- [ ] **Step 3: Replace the offline state with an online repository**

Delete `CACHE_PREFIX`, `QUEUE_KEY`, `syncQueue`, `cacheKey`, `saveCache`, `loadCache`, `queueSync`, `syncAllData`, the old `saveData`, and the old online/offline synchronization listeners.

Immediately after creating `supabaseClient`, add:

```js
const onlineRepository = FSTOnlineCore.createOnlineRepository({
  client: supabaseClient,
  isOnline: () => navigator.onLine && !document.body.classList.contains('online-required')
});
```

Keep `ACTIVE_MODE_KEY`; remove `PROFILE_CACHE_KEY` and all profile-cache fallback logic.

Replace `loadData()` with:

```js
async function loadData() {
  if (!currentTeacher) return false;
  if (!navigator.onLine) {
    data = {classes:[],students:[],sessions:[],attendance:[]};
    setSyncStatus('Connexion Internet requise','danger');
    return false;
  }
  try {
    data = await fetchRemoteData();
    setSyncStatus('En ligne','success');
    return true;
  } catch (error) {
    console.error(error);
    data = {classes:[],students:[],sessions:[],attendance:[]};
    setSyncStatus('Serveur indisponible','danger');
    return false;
  }
}
```

Change `restorePersistentSession()` so a failed remote `profiles` query does not fall back to locally cached role/profile data. If the session exists but the profile query cannot reach Supabase, return through the online-required state instead of granting cached privileges.

- [ ] **Step 4: Run GREEN**

Run: `node --test tests/web/baseline.test.cjs tests/web/online-core.test.cjs tests/web/online-architecture.test.cjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/index.html tests/web/online-architecture.test.cjs
git commit -m "refactor: remove pedagogical offline persistence"
```

---

### Task 4: Convert pedagogical mutations to server-first writes

**Files:**
- Modify: `web/index.html`
- Modify: `tests/web/online-architecture.test.cjs`

**Interfaces:**
- Consumes: `onlineRepository.upsert/remove`.
- Produces: async `addClass`, `addStudent`, `createSession`, `deleteClass`, `deleteStudent`, `deleteSession`, `saveAttendance`, `completeSessionAndReport`, and import flow that only show success after accepted server writes.

- [ ] **Step 1: Extend the failing static test**

Add assertions that the canonical HTML contains these server-first markers and no obsolete bulk snapshot sync:

```js
test('pedagogical writes use the online repository', () => {
  for (const marker of [
    "onlineRepository.upsert('classes'",
    "onlineRepository.upsert('students'",
    "onlineRepository.upsert('sessions'",
    "onlineRepository.upsert('attendance'",
    "onlineRepository.remove('classes'",
    "onlineRepository.remove('students'",
    "onlineRepository.remove('sessions'"
  ]) assert.match(html, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.equal(html.includes('function toRemote()'), false);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/web/online-architecture.test.cjs`

Expected: FAIL because the current CRUD handlers still call the abandoned sync path.

- [ ] **Step 3: Add row mappers**

```js
function classToRemote(x){return {id:String(x.id),teacher_id:currentTeacher.id,name:x.name,track:x.track||null,class_number:x.classNumber||null,group_number:x.groupNumber||null,module:x.module||'',day:x.day||null,start_time:x.start||null,end_time:x.end||null,room:x.room||null};}
function studentToRemote(x){return {id:String(x.id),teacher_id:currentTeacher.id,class_id:String(x.classId),last_name:x.lastname,first_name:x.firstname,email:x.email||null};}
function sessionToRemote(x){return {id:String(x.id),teacher_id:currentTeacher.id,class_id:String(x.classId),session_date:x.date,start_time:x.start,end_time:x.end,completed_at:x.completedAt||null};}
function attendanceToRemote(x){return {id:String(x.id),teacher_id:currentTeacher.id,session_id:String(x.sessionId),student_id:String(x.studentId),status:x.status||'present',comment:x.comment||'',grade:x.grade==null?null:Number(x.grade),grade_updated_at:x.gradeUpdatedAt||null};}

function writeFailure(result, dateValue='') {
  if (dateValue && window.FSTOnlineRuntime) FSTOnlineRuntime.markDateError(dateValue);
  showAlert(result?.offline ? 'Connexion Internet requise' : 'Enregistrement impossible : '+(result?.error?.message || 'Erreur serveur'), 'danger');
  return false;
}
```

- [ ] **Step 4: Make class/student/session creation server-first**

For each create handler: build the proposed row in memory, `await onlineRepository.upsert(...)`, return through `writeFailure` on failure, then mutate `data`, render, and show success only after `result.ok === true`.

Example exact sequence for class creation:

```js
const result = await onlineRepository.upsert('classes',[classToRemote(newClass)]);
if(!result.ok) return writeFailure(result);
data.classes.push(newClass);
renderClasses(); updateAllSelects(); renderMyTimetable();
showAlert('Classe ajoutée avec succès','success');
```

Use the same sequence for students and sessions; pass `newSession.date` to `writeFailure` for session errors.

- [ ] **Step 5: Make deletes server-first**

Example for class deletion:

```js
async function deleteClass(id) {
  if (!confirm('Voulez-vous vraiment supprimer cette classe ?')) return;
  const result = await onlineRepository.remove('classes',id);
  if(!result.ok) return writeFailure(result);
  await FSTOnlineRuntime.refreshAuthoritativeState();
  showAlert('Classe supprimée','success');
}
```

Use the same remote-first pattern for student and session deletion.

- [ ] **Step 6: Make attendance and completion server-first**

`updateAttendance`, `updateAttendanceComment`, and `updateAttendanceGrade` remain in-memory form edits only. Replace `saveAttendance()` with an async function that upserts only attendance rows belonging to the selected session, awaits success, then refreshes authoritative state before showing success.

```js
async function saveAttendance(showSuccess=true) {
  const sessionId=document.getElementById('presence-session').value;
  const rows=data.attendance.filter(x=>String(x.sessionId)===String(sessionId)).map(attendanceToRemote);
  if(rows.length){
    const result=await onlineRepository.upsert('attendance',rows);
    if(!result.ok){const session=data.sessions.find(x=>String(x.id)===String(sessionId));return writeFailure(result,session?.date||'');}
  }
  await FSTOnlineRuntime.refreshAuthoritativeState();
  if(showSuccess) showAlert('Présence enregistrée avec succès','success');
  return true;
}
```

`completeSessionAndReport(sessionId)` must first `await saveAttendance(false)`. Only if that succeeds, upsert the session with `completed_at`, refresh, generate the report, and show the completion success message.

- [ ] **Step 7: Make import online-only**

Parse the file into provisional class/student arrays without modifying global `data`. Upsert new classes first, then students. If either request fails, show a danger alert and immediately call `refreshAuthoritativeState()`; do not show `Import réussi !`. After both calls succeed, refresh from Supabase and then show the success alert.

- [ ] **Step 8: Run GREEN**

Run: `node --test tests/web/*.test.cjs`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add web/index.html tests/web/online-architecture.test.cjs
git commit -m "feat: make pedagogical writes server first"
```

---

### Task 5: Add explicit online-required state and authoritative reconnect refresh

**Files:**
- Create: `web/online-runtime.js`
- Modify: `web/index.html`
- Create: `tests/web/online-runtime-static.test.cjs`

**Interfaces:**
- Produces: `window.FSTOnlineRuntime.initialize`, `requireOnline`, `setOnlineRequired`, `refreshAuthoritativeState`, `markDateError`, `startRealtime`, `stopRealtime`, `applyDateStates`.

- [ ] **Step 1: Write failing static tests**

```js
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('web/index.html','utf8');
const runtimePath='web/online-runtime.js';

test('online-required UI is wired',()=>{
  assert.equal(fs.existsSync(runtimePath),true);
  const runtime=fs.readFileSync(runtimePath,'utf8');
  assert.match(html,/Connexion Internet requise/);
  assert.match(runtime,/addEventListener\('offline'/);
  assert.match(runtime,/addEventListener\('online'/);
  assert.match(runtime,/refreshAuthoritativeState/);
  assert.equal(runtime.includes('localStorage'),false);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/web/online-runtime-static.test.cjs`

Expected: FAIL because runtime and overlay do not exist.

- [ ] **Step 3: Add blocking connection overlay to `web/index.html`**

Add a fixed overlay with id `online-required-overlay`, initially hidden, containing exactly:

```html
<h2>Connexion Internet requise</h2>
<p>Cette application fonctionne uniquement en ligne. Aucune modification n’est enregistrée localement.</p>
<button type="button" class="btn btn-primary" onclick="FSTOnlineRuntime.retry()">Réessayer</button>
```

Add CSS so `body.online-required #online-required-overlay` is visible above the app and blocks interaction.

- [ ] **Step 4: Implement reconnect behavior**

`refreshAuthoritativeState()` must preserve the currently selected presence session id, call `fetchRemoteData()`, replace global `data`, call `renderAll()`, restore the selected session when it still exists, call `loadPresenceSheet()`, refresh Admin UI when active, clear date errors, and return `true`. On failure it returns `false` and keeps the online-required overlay visible.

`offline` event: stop Realtime and show the overlay immediately.

`online` event: keep the overlay visible with a reconnecting message until `refreshAuthoritativeState()` succeeds; then restart Realtime and remove the overlay.

- [ ] **Step 5: Guard authentication and sensitive account mutations**

At the start of `loginTeacher`, `changeOwnPin`, `setAdminPin`, `adminCreateTeacher`, `adminSetRole`, `adminResetPassword`, and `adminDeleteTeacher`, require `FSTOnlineRuntime.requireOnline()`. Do not implement any native/local fallback for these operations.

- [ ] **Step 6: Wire startup and logout**

Load `online-runtime.js` after the main application script. On `DOMContentLoaded`, call `FSTOnlineRuntime.initialize()` before session restoration. `doLogin()` starts Realtime after authoritative `loadData()` succeeds. `logoutTeacher()` and `switchAccount()` call `FSTOnlineRuntime.stopRealtime()`.

- [ ] **Step 7: Run GREEN**

Run: `node --test tests/web/*.test.cjs`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add web/index.html web/online-runtime.js tests/web/online-runtime-static.test.cjs
git commit -m "feat: require online connectivity"
```

---

### Task 6: Add Supabase Realtime subscriptions with non-reloading UI refresh

**Files:**
- Modify: `web/online-runtime.js`
- Modify: `tests/web/online-runtime-static.test.cjs`

**Interfaces:**
- Consumes: `FSTOnlineCore.registerRealtimeTables` and `refreshAuthoritativeState()`.
- Produces: one authenticated Realtime channel per logged-in workspace; events are debounced and trigger an in-place authoritative refresh, not `location.reload()`.

- [ ] **Step 1: Extend failing static tests**

```js
test('realtime refreshes in place without page reload',()=>{
  const runtime=fs.readFileSync(runtimePath,'utf8');
  assert.match(runtime,/registerRealtimeTables/);
  assert.match(runtime,/SUBSCRIBED/);
  assert.match(runtime,/CHANNEL_ERROR|TIMED_OUT|CLOSED/);
  assert.equal(/location\.reload\s*\(/.test(runtime),false);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/web/online-runtime-static.test.cjs`

Expected: FAIL until channel management is implemented.

- [ ] **Step 3: Implement channel lifecycle**

Use one channel named `presence-live-${currentTeacher.id}`. Register all four tables through `FSTOnlineCore.registerRealtimeTables(channel, scheduleRealtimeRefresh)` and then call `.subscribe(status => ...)`.

- `SUBSCRIBED`: set `sync-status` to `Temps réel actif` / success.
- `CHANNEL_ERROR`, `TIMED_OUT`, or `CLOSED`: set a warning state and schedule a retry after 2000 ms.
- Retry sequence: authoritative `refreshAuthoritativeState()` first, then `startRealtime()` only if refresh succeeds.
- Debounce table events by 150 ms so one multi-row operation produces one refresh.
- Never call `location.reload()`.

- [ ] **Step 4: Run GREEN**

Run: `node --test tests/web/*.test.cjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/online-runtime.js tests/web/online-runtime-static.test.cjs
git commit -m "feat: add realtime authoritative refresh"
```

---

### Task 7: Apply shared date-state colors

**Files:**
- Modify: `web/index.html`
- Modify: `web/online-runtime.js`
- Modify: `tests/web/online-core.test.cjs`
- Modify: `tests/web/online-runtime-static.test.cjs`

**Interfaces:**
- Consumes: `FSTOnlineCore.getSessionDateState`.
- Produces: `date-state-gray`, `date-state-orange`, `date-state-blue`, `date-state-green`, `date-state-red` on the session date input and rendered session rows/cards.

- [ ] **Step 1: Add CSS-marker tests before implementation**

```js
test('all five date-state CSS classes exist',()=>{
  for(const state of ['gray','orange','blue','green','red']) assert.match(html,new RegExp(`date-state-${state}`));
});
```

Run and confirm RED.

- [ ] **Step 2: Add the five styles**

Use neutral gray, warning/orange, info/blue, success/green, and danger/red tokens already present in the interface. Do not introduce a second visual design system.

- [ ] **Step 3: Mark rendered sessions with their date**

In `renderSessions()`, add `data-session-date="${session.date}"` to each rendered session card/row. `FSTOnlineRuntime.applyDateStates()` computes:

```js
const sessionsForDate=data.sessions.filter(s=>s.date===dateValue);
const state=FSTOnlineCore.getSessionDateState({
  error: dateErrors.has(dateValue),
  completed: sessionsForDate.some(s=>Boolean(s.completedAt)),
  confirmed: sessionsForDate.length>0,
  selected: document.getElementById('session-date')?.value===dateValue
});
```

Apply the same state logic to `#session-date`. Call `applyDateStates()` after every authoritative refresh, after `renderSessions()`, and on date-input change.

- [ ] **Step 4: Verify priority tests and static tests**

Run: `node --test tests/web/*.test.cjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/index.html web/online-runtime.js tests/web
git commit -m "feat: add shared session date states"
```

---

### Task 8: Publish only the four pedagogical tables to Supabase Realtime

**Files:**
- Create: `supabase/migrations/20260829_enable_pedagogical_realtime.sql`

**Interfaces:**
- Produces: membership of `public.classes`, `public.students`, `public.sessions`, and `public.attendance` in publication `supabase_realtime`; no RLS policy changes.

- [ ] **Step 1: Record the pre-migration verification query**

Run against project `dbslzmvzbxczpqyektpx`:

```sql
select tablename
from pg_publication_tables
where pubname='supabase_realtime'
  and schemaname='public'
  and tablename in ('classes','students','sessions','attendance')
order by tablename;
```

Expected before migration: no rows for these four tables.

- [ ] **Step 2: Add idempotent migration**

```sql
do $$
declare
  t text;
begin
  foreach t in array array['classes','students','sessions','attendance'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename=t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
```

Do not alter RLS and do not set `REPLICA IDENTITY FULL`; the UI performs a full authorized refresh after any change event.

- [ ] **Step 3: Apply through the Supabase migration tool**

Migration name: `enable_pedagogical_realtime`.

- [ ] **Step 4: Verify publication and RLS**

```sql
select c.relname,
       c.relrowsecurity,
       exists (
         select 1 from pg_publication_tables p
         where p.pubname='supabase_realtime'
           and p.schemaname='public'
           and p.tablename=c.relname
       ) as realtime_enabled
from pg_class c
join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public'
  and c.relname in ('classes','students','sessions','attendance')
order by c.relname;
```

Expected: four rows, `relrowsecurity=true`, `realtime_enabled=true`.

- [ ] **Step 5: Commit migration**

```bash
git add supabase/migrations/20260829_enable_pedagogical_realtime.sql
git commit -m "feat: enable pedagogical realtime publication"
```

---

### Task 9: Convert Windows to a thin hosted-WebView client

**Files:**
- Create: `windows/GestionPresenceFST/AppUrls.cs`
- Modify: `windows/GestionPresenceFST/MainWindow.xaml`
- Modify: `windows/GestionPresenceFST/MainWindow.xaml.cs`
- Modify: `windows/GestionPresenceFST/GestionPresenceFST.csproj`
- Create: `windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj`
- Create: `windows/GestionPresenceFST.Tests/AppUrlsTests.cs`
- Create: `windows/GestionPresenceFST.Tests/OnlineArchitectureTests.cs`

**Interfaces:**
- Produces: `AppUrls.ProductionWebUri` and native retry/fallback UI.
- Windows must never navigate to a local `web/index.html` production fallback.

- [ ] **Step 1: Write failing Windows tests**

```csharp
using Xunit;
namespace GestionPresenceFST.Tests;

public class AppUrlsTests
{
    [Fact]
    public void ProductionWebUriIsApprovedGithubPagesUrl() =>
        Assert.Equal("https://souhailsouai.github.io/gestion-presence-fst/", AppUrls.ProductionWebUri.AbsoluteUri);
}
```

`OnlineArchitectureTests` reads `GestionPresenceFST.csproj` and `MainWindow.xaml.cs` and asserts:

```csharp
Assert.DoesNotContain("Microsoft.Data.Sqlite", project, StringComparison.OrdinalIgnoreCase);
Assert.DoesNotContain("web\\index.html", project, StringComparison.OrdinalIgnoreCase);
Assert.DoesNotContain("Path.Combine", mainWindow, StringComparison.Ordinal);
Assert.Contains("AppUrls.ProductionWebUri", mainWindow, StringComparison.Ordinal);
```

- [ ] **Step 2: Run RED on Windows**

Run: `dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj -c Release`

Expected: FAIL because `AppUrls` and the test project do not exist yet.

- [ ] **Step 3: Add `AppUrls.cs`**

```csharp
namespace GestionPresenceFST;

public static class AppUrls
{
    public static readonly Uri ProductionWebUri =
        new("https://souhailsouai.github.io/gestion-presence-fst/", UriKind.Absolute);
}
```

- [ ] **Step 4: Remove local HTML packaging from the project**

Keep only the WebView2 package reference. Remove the `<Content Include="..\..\web\index.html" ... />` item from `GestionPresenceFST.csproj`.

- [ ] **Step 5: Add native connection fallback**

`MainWindow.xaml` keeps WebView2 and overlays a hidden panel containing `Connexion Internet requise` and a `Réessayer` button.

`MainWindow.xaml.cs` must:

```csharp
await Browser.EnsureCoreWebView2Async();
Browser.NavigationCompleted += OnNavigationCompleted;
Browser.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
Browser.CoreWebView2.Settings.IsZoomControlEnabled = false;
Browser.Source = AppUrls.ProductionWebUri;
```

`OnNavigationCompleted` hides the overlay only on `e.IsSuccess`; otherwise it shows the overlay. `Réessayer` assigns `Browser.Source = AppUrls.ProductionWebUri` again. Catch WebView initialization/navigation exceptions and show the same fallback state; never load a bundled HTML file.

- [ ] **Step 6: Run GREEN**

Run: `dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj -c Release`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add windows
git commit -m "feat: load hosted web app in Windows"
```

---

### Task 10: Add production-only GitHub Pages deployment

**Files:**
- Create: `.github/workflows/deploy-pages.yml`
- Create: `tests/web/pages-workflow.test.cjs`

**Interfaces:**
- Consumes: committed `web/` directory.
- Produces: GitHub Pages deployment only from `main`.

- [ ] **Step 1: Write failing workflow test**

```js
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const p='.github/workflows/deploy-pages.yml';

test('Pages deploy is main-only and publishes web directory',()=>{
  assert.equal(fs.existsSync(p),true);
  const y=fs.readFileSync(p,'utf8');
  assert.match(y,/branches:\s*\n\s*- main/);
  assert.equal(y.includes('feature/windows-online-realtime'),false);
  assert.match(y,/path:\s*web/);
  assert.match(y,/actions\/deploy-pages@v4/);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/web/pages-workflow.test.cjs`

Expected: FAIL because workflow does not exist.

- [ ] **Step 3: Add workflow**

```yaml
name: Deploy Web
on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - run: node --test tests/web/*.test.cjs

  deploy:
    needs: test
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: web
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 4: Run GREEN**

Run: `node --test tests/web/*.test.cjs`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/deploy-pages.yml tests/web/pages-workflow.test.cjs
git commit -m "ci: deploy production web from main"
```

---

### Task 11: Add Windows CI build and artifact

**Files:**
- Create: `.github/workflows/build-windows.yml`

**Interfaces:**
- Produces: successful Windows test/publish job and artifact `Gestion-Presence-FST-Windows-x64`.

- [ ] **Step 1: Add Windows workflow**

```yaml
name: Build Windows
on:
  push:
    branches:
      - feature/windows-online-realtime
      - main
  pull_request:

jobs:
  windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '8.0.x'
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Test shared web
        run: node --test tests/web/*.test.cjs
      - name: Restore Windows tests
        run: dotnet restore windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj
      - name: Test Windows
        run: dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj --configuration Release --no-restore
      - name: Publish Windows x64
        run: dotnet publish windows/GestionPresenceFST/GestionPresenceFST.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o publish/windows-x64
      - uses: actions/upload-artifact@v4
        with:
          name: Gestion-Presence-FST-Windows-x64
          path: publish/windows-x64
```

- [ ] **Step 2: Push and inspect the actual GitHub Actions job**

Expected: web tests PASS, xUnit tests PASS, publish PASS, artifact upload PASS.

- [ ] **Step 3: Commit if workflow was not already committed with the triggering push**

```bash
git add .github/workflows/build-windows.yml
git commit -m "ci: build online Windows client"
```

---

### Task 12: End-to-end verification and production readiness

**Files:**
- Modify only if verification exposes a defect.

**Interfaces:**
- Validates all acceptance criteria from the spec.

- [ ] **Step 1: Run the complete automated suite locally/CI**

```bash
node --test tests/web/*.test.cjs
dotnet test windows/GestionPresenceFST.Tests/GestionPresenceFST.Tests.csproj -c Release
dotnet publish windows/GestionPresenceFST/GestionPresenceFST.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o publish/windows-x64
```

Expected: all commands succeed.

- [ ] **Step 2: Re-run Supabase backend verification**

Confirm exactly the four pedagogical tables are members of `supabase_realtime` and all four still have RLS enabled.

- [ ] **Step 3: Verify no abandoned offline implementation is present**

Search production branch for:

```bash
grep -RniE "Microsoft.Data.Sqlite|sync_queue|sync_conflicts|attendanceSupabaseCache_|attendanceSupabase_syncQueue|queueSync\(" web windows || true
```

Expected: no matches in production Web/Windows code.

- [ ] **Step 4: Perform manual two-client smoke test**

1. Sign in to the browser and Windows with authorized accounts.
2. Change attendance or a grade in one client; confirm the other updates automatically without manual page reload.
3. Repeat with a session, student, and class mutation where permitted.
4. Disconnect Windows networking; confirm `Connexion Internet requise` appears and no write is accepted locally.
5. Reconnect; confirm an authoritative Supabase refresh occurs before normal interaction resumes.
6. Verify date colors gray/orange/blue/green/red with representative states.
7. Verify teacher workspace, Admin workspace, Super Admin promotion/removal protections, account creation/reset/PIN flows, and persistent session restoration.

- [ ] **Step 5: Verify GitHub Pages production deployment policy**

Before merge, confirm feature-branch pushes do not deploy Pages. After merge to `main`, confirm `Deploy Web` succeeds and the production URL serves the tested `web/index.html`.

- [ ] **Step 6: Verify final Windows artifact from a fresh GitHub Actions run**

Expected artifact name: `Gestion-Presence-FST-Windows-x64`.

- [ ] **Step 7: Commit only evidence-driven fixes**

If all checks pass, do not make a cosmetic follow-up commit. If a test exposes a defect, add a failing regression test first, apply the minimal fix, rerun the complete verification, then commit that fix.
