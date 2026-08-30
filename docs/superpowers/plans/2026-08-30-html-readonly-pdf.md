# HTML Read-Only Sessions and Integrated PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the HTML client show other teachers' session metadata read-only, preserve owner-only pedagogical data, give Admin full management rights, and provide reliable downloadable session/general PDFs bundled into the final HTML.

**Architecture:** Supabase RLS remains the authoritative write boundary. The browser keeps owned pedagogical data separate from foreign read-only metadata and uses role/ownership helpers before every mutation. PDF generation uses pinned local `jspdf@4.2.1` and `jspdf-autotable@5.0.8`, then the build pipeline inlines the required JavaScript into `web/index.html` so PDF creation has no runtime CDN dependency.

**Tech Stack:** Supabase/Postgres RLS, Supabase JS, vanilla HTML/JavaScript, Node 22 tests, Python build scripts, jsPDF 4.2.1, jsPDF-AutoTable 5.0.8.

**Spec:** `docs/superpowers/specs/2026-08-30-html-readonly-pdf-design.md`

## Global Constraints

- Teacher can fully manage only records owned by their authenticated user id.
- Teacher can see another teacher only as safe read-only session metadata: teacher, track/class/group, module, date, start/end time, room.
- Teacher must never receive another teacher's students, attendance, comments, grades, detailed session report, or general pedagogical report.
- Admin can view and manage all pedagogical records and generate all reports.
- Supabase RLS is authoritative; UI restrictions are defense in depth.
- Final `web/index.html` must contain the PDF engine and application PDF logic without jsPDF/html2canvas CDN dependencies.
- No offline pedagogical storage.
- Do not rebuild Android/APK or release a new Windows executable until the HTML version is validated.

---

### Task 1: Pin and bundle the PDF engine

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Modify: `scripts/build_single_file_release.py`
- Modify: `.github/workflows/build-windows.yml`
- Test: `tests/web/pdf-bundle.test.cjs`

**Interfaces:**
- Consumes: `web/index.html` produced by `scripts/build_online_web.py`.
- Produces: final `web/index.html` containing jsPDF, AutoTable, and application report code inline.

- [ ] **Step 1: Write the failing bundle test**

```js
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('final HTML bundles PDF engine without runtime CDN dependencies',()=>{
  const html=fs.readFileSync('web/index.html','utf8');
  assert.match(html,/jspdf/i);
  assert.match(html,/autoTable/);
  assert.doesNotMatch(html,/cdn.*jspdf|unpkg.*jspdf|html2canvas/i);
  assert.match(html,/data-fst-pdf-engine="inline"/);
});
```

- [ ] **Step 2: Run RED**

Run:

```bash
python scripts/build_online_web.py
python scripts/build_single_file_release.py
node --test tests/web/pdf-bundle.test.cjs
```

Expected: FAIL because no PDF engine is bundled.

- [ ] **Step 3: Pin dependencies**

Run:

```bash
npm install --save-exact jspdf@4.2.1 jspdf-autotable@5.0.8
```

Commit both `package.json` and `package-lock.json`.

- [ ] **Step 4: Extend the single-file builder**

Read these exact files during the build:

```text
node_modules/jspdf/dist/jspdf.umd.min.js
node_modules/jspdf-autotable/dist/jspdf.plugin.autotable.min.js
web/report-pdf.js
```

Inline them before `</body>` under explicit markers:

```html
<script data-fst-pdf-engine="inline">...</script>
<script data-fst-pdf-reports="inline">...</script>
```

Add `npm ci` before the HTML build in CI.

- [ ] **Step 5: Run GREEN**

Run all web tests:

```bash
python scripts/build_online_web.py
python scripts/build_single_file_release.py
node --test tests/web/*.test.cjs
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json scripts/build_single_file_release.py .github/workflows/build-windows.yml tests/web/pdf-bundle.test.cjs
git commit -m "build: bundle PDF engine into final HTML"
```

---

### Task 2: Enforce Supabase read/write boundaries

**Files:**
- Create: `supabase/tests/teacher_readonly_visibility.sql`
- Create via Supabase CLI only: `supabase/migrations/*_teacher_readonly_visibility.sql`

**Interfaces:**
- Produces: authenticated SELECT access to `classes` and `sessions`; owner-or-Admin mutations remain enforced; `students` and `attendance` remain owner-or-Admin only.

- [ ] **Step 1: Check current Supabase changelog and RLS docs**

Fetch `https://supabase.com/changelog.md`, scan relevant breaking changes, then verify current RLS guidance before changing policies.

- [ ] **Step 2: Write a transactional RLS regression test**

The SQL test must run inside `BEGIN ... ROLLBACK`, select one non-admin profile and one admin profile dynamically, create temporary class/session/student/attendance fixtures, switch request claims with `set_config('request.jwt.claim.sub', ..., true)` plus `SET LOCAL ROLE authenticated`, and raise an exception unless all of these are true:

```text
teacher: foreign class SELECT succeeds
teacher: foreign session SELECT succeeds
teacher: foreign session UPDATE affects 0 rows
teacher: foreign session DELETE affects 0 rows
teacher: foreign students SELECT returns 0 rows
teacher: foreign attendance SELECT returns 0 rows
teacher: foreign attendance UPDATE affects 0 rows
admin: all fixture rows are visible
admin: foreign session UPDATE succeeds
```

- [ ] **Step 3: Run RED against current policies**

Execute `supabase/tests/teacher_readonly_visibility.sql` against project `dbslzmvzbxczpqyektpx`.

Expected: FAIL because foreign class/session SELECT is currently blocked.

- [ ] **Step 4: Iterate policy SQL with `execute_sql`**

Replace only these SELECT policies:

```sql
drop policy if exists classes_select_owner_or_admin on public.classes;
create policy classes_select_authenticated
on public.classes for select
to authenticated
using (true);

drop policy if exists sessions_select_owner_or_admin on public.sessions;
create policy sessions_select_authenticated
on public.sessions for select
to authenticated
using (true);
```

Do not weaken INSERT/UPDATE/DELETE policies on `classes`, `sessions`, `students`, or `attendance`.

- [ ] **Step 5: Run GREEN and security advisors**

Re-run the transactional test. Then run Supabase security advisors and verify RLS remains enabled on all four exposed tables.

Expected: regression test PASS; no new security-advisor finding caused by this change.

- [ ] **Step 6: Generate migration through the Supabase CLI**

Run:

```bash
supabase migration new teacher_readonly_visibility
```

Put only the verified policy SQL in the generated migration file. Do not hand-invent a migration timestamp.

- [ ] **Step 7: Commit**

```bash
git add supabase/tests/teacher_readonly_visibility.sql supabase/migrations/*_teacher_readonly_visibility.sql
git commit -m "security: allow read-only cross-teacher session metadata"
```

---

### Task 3: Separate owned data from foreign read-only session metadata

**Files:**
- Create: `web/access-control.js`
- Modify: `scripts/build_online_web.py`
- Modify: `scripts/build_single_file_release.py`
- Modify: `web/online-runtime.js`
- Test: `tests/web/access-control.test.cjs`

**Interfaces:**
- Produces: `FSTAccessControl.isAdmin()`, `FSTAccessControl.canManageRecord(record)`, `FSTAccessControl.foreignSessions`, and `FSTAccessControl.refreshForeignSessionDirectory()`.

- [ ] **Step 1: Write failing access-control tests**

Assert the source contains real ownership guards and that teacher/admin semantics are explicit:

```js
assert.match(js,/canManageRecord/);
assert.match(js,/teacherId.*currentTeacher\.id/);
assert.match(js,/role.*admin/);
assert.match(js,/Lecture seule/);
assert.match(js,/foreignSessions/);
```

Also assert `online-runtime.js` calls `canManageRecord` before delete, attendance save, completion, and report access.

- [ ] **Step 2: Run RED**

Run:

```bash
node --test tests/web/access-control.test.cjs
```

Expected: FAIL because the helper/module does not exist.

- [ ] **Step 3: Implement role and ownership helpers**

Use trusted profile state already loaded from Supabase:

```js
function isAdmin(){ return currentTeacher?.role==='admin'; }
function canManageRecord(record){
  return Boolean(record) && (isAdmin() || String(record.teacherId)===String(currentTeacher?.id));
}
```

Never use editable user metadata for authorization.

- [ ] **Step 4: Change remote loading**

For a normal teacher:

```text
classes: load all metadata, but mark foreign rows read-only
sessions: load all metadata, but mark foreign rows read-only
students: query with .eq('teacher_id', currentTeacher.id)
attendance: query with .eq('teacher_id', currentTeacher.id)
```

For Admin, load all four tables without the owner filter.

Every mapped class/session must preserve `teacherId` from the database. Do not overwrite foreign `teacher_id` with `currentTeacher.id`.

- [ ] **Step 5: Guard every mutation in `online-runtime.js`**

Before issuing any mutation against an existing record:

```js
if(!FSTAccessControl.canManageRecord(record)){
  showAlert('Cette séance est en lecture seule.','danger');
  return false;
}
```

Apply this to session delete, attendance save, session completion, notes access, and any edit path that can touch an existing foreign record. RLS remains the final enforcement layer.

- [ ] **Step 6: Run GREEN**

Run all web tests.

- [ ] **Step 7: Commit**

```bash
git add web/access-control.js web/online-runtime.js scripts/build_online_web.py scripts/build_single_file_release.py tests/web/access-control.test.cjs
git commit -m "feat: add read-only foreign session access"
```

---

### Task 4: Render foreign sessions as metadata-only read-only cards

**Files:**
- Modify: `web/access-control.js`
- Test: `tests/web/access-control.test.cjs`

**Interfaces:**
- Consumes: class/session `teacherId`, teacher directory data, and `canManageRecord`.
- Produces: session-list rendering with full controls for owned/Admin rows and safe metadata-only rendering for foreign teacher rows.

- [ ] **Step 1: Extend the failing test**

Require the foreign-session template to contain exactly these safe labels:

```text
Enseignant
Filière
Classe
Groupe
Module
Date
Horaire
Salle
Lecture seule
```

Require that the foreign branch does not emit handlers for:

```text
deleteSession
openSessionForNotes
completeSessionAndReport
generateSessionPdf
```

- [ ] **Step 2: Run RED**

Expected: FAIL.

- [ ] **Step 3: Implement renderer override**

Owned/Admin card: preserve existing notes/report/delete actions.

Foreign teacher card: display only approved metadata plus a `Lecture seule` badge. Do not display pointage counts, completion action, student count, attendance, comments, grades, notes button, delete button, or PDF button.

Resolve teacher display names through the existing authenticated teacher directory; do not expose email or private profile fields.

- [ ] **Step 4: Run GREEN and commit**

```bash
node --test tests/web/access-control.test.cjs
git add web/access-control.js tests/web/access-control.test.cjs
git commit -m "feat: render foreign sessions read-only"
```

---

### Task 5: Generate downloadable session PDFs

**Files:**
- Create: `web/report-pdf.js`
- Test: `tests/web/report-pdf.test.cjs`

**Interfaces:**
- Produces: `FSTPdf.generateSessionPdf(sessionId)` and `FSTPdf.buildSessionReportModel(sessionId)`.

- [ ] **Step 1: Write failing model/security tests**

Test pure report-model behavior with fixtures:

```text
teacher + owned session => report model returned
teacher + foreign session => access denied
admin + any session => report model returned
```

Require report model fields: institution, academicYear, teacher, track, classNumber, groupNumber, module, date, start, end, room, students[].

- [ ] **Step 2: Run RED**

Expected: FAIL because `web/report-pdf.js` is absent.

- [ ] **Step 3: Implement session report model and PDF**

Use `jspdf.jsPDF` and AutoTable. Generate a real `.pdf` using `doc.save(...)` with a deterministic safe filename such as:

```text
Presence_TP_<class>_<YYYY-MM-DD>.pdf
```

Include institution, `2026/2027`, teacher, class/group/module, date/time/room, and the student table with attendance, comments, and grades when available.

Block foreign-session PDF generation for non-admin teachers before building any detailed model.

- [ ] **Step 4: Add PDF-engine smoke test**

Using the pinned npm packages in Node, generate a one-page document with AutoTable and assert:

```js
const bytes=doc.output('arraybuffer');
assert.ok(bytes.byteLength>1000);
```

This verifies the pinned engine can physically produce PDF bytes in CI.

- [ ] **Step 5: Run GREEN and commit**

```bash
node --test tests/web/report-pdf.test.cjs
git add web/report-pdf.js tests/web/report-pdf.test.cjs
git commit -m "feat: generate session PDF downloads"
```

---

### Task 6: Generate general PDFs with Admin teacher filter

**Files:**
- Modify: `web/report-pdf.js`
- Modify: `web/access-control.js`
- Test: `tests/web/report-pdf.test.cjs`

**Interfaces:**
- Produces: `FSTPdf.buildGeneralReportModel(teacherId)` and `FSTPdf.generateGeneralPdf(teacherId)`.

- [ ] **Step 1: Write failing filtering tests**

Verify:

```text
normal teacher requesting own report => only own data
normal teacher requesting foreign teacher id => access denied
admin requesting empty teacher filter => all teachers
admin requesting one teacher id => only that teacher
```

- [ ] **Step 2: Run RED**

Expected: FAIL.

- [ ] **Step 3: Implement general report**

Teacher UI: no teacher selector; export always uses current teacher id.

Admin UI: add an `Enseignant` filter with `Tous les enseignants` plus directory names.

Use AutoTable pagination; never render another teacher's detailed pedagogical rows for a normal teacher.

- [ ] **Step 4: Run GREEN and commit**

```bash
node --test tests/web/report-pdf.test.cjs
git add web/report-pdf.js web/access-control.js tests/web/report-pdf.test.cjs
git commit -m "feat: add general PDF reporting"
```

---

### Task 7: Final standalone HTML verification and delivery

**Files:**
- Modify if needed: `tests/web/single-file-release.test.cjs`
- Generated artifact: `web/index.html`

**Interfaces:**
- Produces: one final standalone HTML suitable for browser validation before Windows/APK propagation.

- [ ] **Step 1: Extend final-release assertions**

Require the built HTML to contain:

```text
data-fst-pdf-engine="inline"
data-fst-pdf-reports="inline"
Lecture seule
canManageRecord
generateSessionPdf
generateGeneralPdf
```

Reject external runtime PDF references.

- [ ] **Step 2: Run the full build/test sequence**

```bash
npm ci
python scripts/build_online_web.py
python scripts/build_single_file_release.py
node --test tests/web/*.test.cjs
```

Expected: 0 failed tests.

- [ ] **Step 3: Re-run Supabase RLS regression test**

Expected: teacher cannot mutate foreign session/attendance; foreign students/attendance remain invisible; Admin can manage all.

- [ ] **Step 4: Manual browser acceptance**

Validate three sessions/views:

```text
Teacher own session: editable + PDF available
Teacher foreign session: metadata-only + Lecture seule + no detailed PDF
Admin foreign-owned session: editable + detailed PDF available
```

Generate one session PDF and one general PDF and open both files to verify they are valid, paginated PDFs.

- [ ] **Step 5: Commit final test adjustments**

```bash
git add tests/web/single-file-release.test.cjs
git commit -m "test: verify final standalone HTML reporting"
```

- [ ] **Step 6: Deliver HTML only for user validation**

Copy the generated `web/index.html` to a clearly named final HTML artifact. Do not produce a new APK or Windows `.exe` until the user validates this HTML behavior.
