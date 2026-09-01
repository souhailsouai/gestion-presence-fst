# Web V5 Planning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Web V5 TP Physique application with the official MPI/PC timetable reference, a dated alternating planning from 2026-09-14 to 2026-12-13, manual M1-M6 and teacher assignment per group, pause/undefined weeks, strict role permissions, robust imports, and preserved attendance/grade/PDF behavior.

**Architecture:** Add an additive Supabase `session_plans` planning layer that is separate from real `sessions`. The Web client gets a pure timetable/planning model, an online planning runtime, and a planning UI injected into the generated HTML; real attendance sessions are created idempotently from active plans through a guarded RPC. Existing attendance, grade-only-after-closure, PDF, Excel/CSV, realtime, and single-file build modules are retained and adapted rather than replaced.

**Tech Stack:** HTML/CSS/vanilla JavaScript, Node.js 22 `node:test`, Supabase/PostgreSQL 17 with RLS, SheetJS 0.18.5, jsPDF 4.2.1 + AutoTable 5.0.8, Python 3.12 standalone builder.

**Spec:** `docs/superpowers/specs/2026-09-01-web-v5-planning-design.md`

## Global Constraints

- Web-only scope; do not modify Windows or Android in V5.
- Class families exposed to the user are exactly MPI1-A, MPI1-B, MPI1-C, MPI1-D, MPI1-E, and PC1-A.
- Operational groups exposed are G1-G4; a class may use 3 or 4 groups.
- Module is always `TP Physique`.
- All time display and input uses strict 24-hour `HH:MM`.
- Official reference is immutable in code; day/start/end may be overridden per class/group and reset to official values.
- Planning period is 2026-09-14 through 2026-12-13.
- Alternation: Monday MPI1-A/MPI1-E, Thursday MPI1-C/MPI1-D, Friday MPI1-B/PC1-A.
- Manipulation is manually selected per group/date from M1-M6 or unassigned.
- Planning states are `planned`, `pause`, `undefined`.
- Six teachers exist initially, but Admin may add more; weekly target is 2 assigned group-sessions per teacher, advisory only.
- All authenticated teachers can read all timetables/planning/teacher assignments.
- Only Admin can modify planning/classes/groups/students/teacher assignments.
- Assigned teacher can edit attendance/comment/grade before closure and grade only after closure.
- Pause/undefined rows never create attendance sessions.
- Existing attendance and grades must be preserved.
- Supabase RLS is authoritative; UI hiding alone is not access control.

---

### Task 1: Add the planning schema, RLS, and guarded session creation

**Files:**
- Create: `supabase/migrations/20260901_web_v5_session_plans.sql`
- Create: `tests/web/v5-migration-contract.test.cjs`

**Interfaces:**
- Consumes: existing `public.profiles`, `public.academic_years`, `public.classes`, `public.sessions`, and current authentication/RLS.
- Produces: `public.session_plans`, `public.start_session_plan(uuid)`, and server-side admin/teacher guards used by the Web runtime.

- [ ] **Step 1: Write the failing migration contract test**

```js
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const p='supabase/migrations/20260901_web_v5_session_plans.sql';

test('V5 migration defines plans, admin-only writes and guarded session start',()=>{
  assert.equal(fs.existsSync(p),true);
  const sql=fs.readFileSync(p,'utf8');
  for(const marker of [
    'create table if not exists public.session_plans',
    "check (manipulation in ('M1','M2','M3','M4','M5','M6') or manipulation is null)",
    "check (status in ('planned','pause','undefined'))",
    'unique (class_id, plan_date)',
    'create policy session_plans_select_authenticated',
    'create policy session_plans_admin_insert',
    'create policy session_plans_admin_update',
    'create policy session_plans_admin_delete',
    'create or replace function public.start_session_plan',
    'session plan is not assigned to current teacher',
    'session plan is not active',
    'grade_only'
  ]) assert.ok(sql.includes(marker),`missing ${marker}`);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:
```bash
node tests/web/v5-migration-contract.test.cjs
```
Expected: FAIL because `20260901_web_v5_session_plans.sql` does not exist.

- [ ] **Step 3: Implement the additive migration**

Create the table with this contract:

```sql
create table if not exists public.session_plans (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years(id),
  class_id uuid not null references public.classes(id),
  teacher_id uuid null references public.profiles(id),
  plan_date date not null,
  start_time time without time zone not null,
  end_time time without time zone not null,
  module text not null default 'TP Physique' check (module = 'TP Physique'),
  manipulation text null check (manipulation in ('M1','M2','M3','M4','M5','M6') or manipulation is null),
  status text not null default 'undefined' check (status in ('planned','pause','undefined')),
  session_id uuid null unique references public.sessions(id),
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid null references public.profiles(id),
  deleted_at timestamptz null,
  unique (class_id, plan_date),
  check (end_time > start_time)
);
```

Add a security-definer helper used by policies:

```sql
create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists(
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.deleted_at is null
  );
$$;
```

Enable RLS and add:

```sql
create policy session_plans_select_authenticated
on public.session_plans for select to authenticated
using (deleted_at is null);

create policy session_plans_admin_insert
on public.session_plans for insert to authenticated
with check (public.current_user_is_admin());

create policy session_plans_admin_update
on public.session_plans for update to authenticated
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

create policy session_plans_admin_delete
on public.session_plans for delete to authenticated
using (public.current_user_is_admin());
```

Tighten class/student mutation policies so teachers remain read-only for administrative data. Preserve read access required by the app, but make insert/update/delete Admin-only.

Add a `students` SELECT policy that permits Admin or a teacher assigned to a matching real/planned session to read that group roster. The teacher must not gain mutation rights.

Add `public.start_session_plan(p_plan_id uuid)` as `SECURITY DEFINER`. It must:
1. load an undeleted plan;
2. reject `pause` and `undefined` with `session plan is not active`;
3. require Admin or `plan.teacher_id = auth.uid()`, otherwise raise `session plan is not assigned to current teacher`;
4. return the existing `session_id` if already linked;
5. otherwise insert one `sessions` row with `teacher_id`, `class_id`, `plan_date`, `start_time`, `end_time` from the plan;
6. update `session_plans.session_id`, `updated_at`, `updated_by`;
7. return the created session UUID.

Add a session mutation guard so a non-admin assigned teacher may complete their own session but cannot change `teacher_id`, `class_id`, `session_date`, `start_time`, or `end_time`, and cannot delete the session. Existing grade-only attendance trigger behavior remains intact.

Add `session_plans` to the Supabase realtime publication if it is not already present.

- [ ] **Step 4: Run the migration contract test and verify GREEN**

Run:
```bash
node tests/web/v5-migration-contract.test.cjs
```
Expected: PASS.

- [ ] **Step 5: Apply the migration to the connected Supabase project and inspect the resulting schema**

Use the connected Supabase migration/SQL capability. Verify that `session_plans` has the exact checks/FKs/unique constraint above, RLS is enabled, and the RPC exists.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260901_web_v5_session_plans.sql tests/web/v5-migration-contract.test.cjs
git commit -m "feat: add V5 session planning schema"
```

---

### Task 2: Implement the official TP reference and alternating date generator

**Files:**
- Create: `web/tp-reference.js`
- Create: `tests/web/tp-reference.test.cjs`

**Interfaces:**
- Produces: `FSTTPReference.classLabel(record)`, `FSTTPReference.groupLabel(record)`, `FSTTPReference.officialFor(track,classNumber)`, `FSTTPReference.generateAlternatingSlots(start,end)`, `FSTTPReference.applyOfficialToForm()`.
- Consumed by: class UI, planning model, import resolver, PDFs.

- [ ] **Step 1: Write failing pure-function tests**

```js
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');

function load(){
  const ctx={window:{}};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('web/tp-reference.js','utf8'),ctx);
  return ctx.window.FSTTPReference;
}

test('class labels expose MPI1-A..E and PC1-A only',()=>{
  const r=load();
  assert.equal(r.classLabel({track:'MPI',classNumber:1}),'MPI1-A');
  assert.equal(r.classLabel({track:'MPI',classNumber:5}),'MPI1-E');
  assert.equal(r.classLabel({track:'PC',classNumber:1}),'PC1-A');
  assert.equal(r.isAllowedClass('PC',2),false);
});

test('official timetable is exact and module is fixed',()=>{
  const r=load();
  assert.deepEqual(r.officialFor('MPI',1),{label:'MPI1-A',module:'TP Physique',day:'Lundi',start:'13:45',end:'18:00'});
  assert.deepEqual(r.officialFor('PC',1),{label:'PC1-A',module:'TP Physique',day:'Vendredi',start:'13:30',end:'17:30'});
});

test('alternation covers 14 Sep through 13 Dec with exact first and last slots',()=>{
  const r=load();
  const slots=r.generateAlternatingSlots('2026-09-14','2026-12-13');
  assert.deepEqual(slots.slice(0,3).map(x=>[x.date,x.classLabel]),[
    ['2026-09-14','MPI1-A'],['2026-09-17','MPI1-C'],['2026-09-18','MPI1-B']
  ]);
  assert.deepEqual(slots.slice(-3).map(x=>[x.date,x.classLabel]),[
    ['2026-12-07','MPI1-A'],['2026-12-10','MPI1-C'],['2026-12-11','MPI1-B']
  ]);
});
```

- [ ] **Step 2: Run and verify RED**

Run:
```bash
node tests/web/tp-reference.test.cjs
```
Expected: FAIL because `web/tp-reference.js` is missing.

- [ ] **Step 3: Implement the reference**

Use an immutable map:

```js
const OFFICIAL={
  'MPI:1':{label:'MPI1-A',module:'TP Physique',day:'Lundi',start:'13:45',end:'18:00'},
  'MPI:2':{label:'MPI1-B',module:'TP Physique',day:'Vendredi',start:'13:30',end:'17:30'},
  'MPI:3':{label:'MPI1-C',module:'TP Physique',day:'Jeudi',start:'13:45',end:'17:30'},
  'MPI:4':{label:'MPI1-D',module:'TP Physique',day:'Jeudi',start:'13:30',end:'17:30'},
  'MPI:5':{label:'MPI1-E',module:'TP Physique',day:'Lundi',start:'13:30',end:'17:30'},
  'PC:1':{label:'PC1-A',module:'TP Physique',day:'Vendredi',start:'13:30',end:'17:30'}
};
```

Generate weeks by calendar date parts, not by parsing date-only values through local timezone-dependent `Date` constructors. Alternate parity by week index:
- even week index: MPI1-A, MPI1-C, MPI1-B;
- odd week index: MPI1-E, MPI1-D, PC1-A.

Each slot returns `{weekIndex, weekStart, date, classLabel, track, classNumber, day, start, end, module:'TP Physique'}`.

`applyOfficialToForm()` sets `class-module` to `TP Physique`, read-only; sets `class-day`, `class-start`, `class-end`; and inserts one `Rétablir le créneau officiel` button if absent.

PC class select must expose only A. MPI exposes A-E.

- [ ] **Step 4: Run and verify GREEN**

Run:
```bash
node tests/web/tp-reference.test.cjs
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/tp-reference.js tests/web/tp-reference.test.cjs
git commit -m "feat: add official TP timetable reference"
```

---

### Task 3: Align class/group UI, student organization, and importer with V5 catalog

**Files:**
- Modify: `web/class-structure-pdf.js`
- Modify: `web/student-management.js`
- Modify: `web/student-import.js`
- Modify: `web/access-control.js`
- Modify: `tests/web/web-time-students-import.test.cjs`
- Create: `tests/web/v5-class-catalog.test.cjs`

**Interfaces:**
- Consumes: `FSTTPReference.classLabel`, `groupLabel`, `officialFor`, `isAllowedClass`.
- Produces: V5 class blocks, G1-G4 group selectors, Admin-only student mutations, import recognition for MPI1-A..E and PC1-A.

- [ ] **Step 1: Replace the old G1-G10 expectations with failing V5 expectations**

Test the source contracts:

```js
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('V5 exposes only G1-G4 and delegates labels to TP reference',()=>{
  const js=fs.readFileSync('web/class-structure-pdf.js','utf8');
  assert.match(js,/FSTTPReference/);
  assert.match(js,/Array\.from\(\{length:4\}/);
  assert.doesNotMatch(js,/length:10/);
  assert.match(js,/PC1-A/);
});

test('student mutations are admin-only in client UI',()=>{
  const js=fs.readFileSync('web/student-management.js','utf8');
  assert.match(js,/isAdmin/);
  assert.match(js,/Gestion des étudiants réservée à l’administrateur/);
});
```

Update import tests so rows such as `MPI1-A;G2` and `PC1-A;G1` resolve, while `PC1-B` and `G5` reject.

- [ ] **Step 2: Run and verify RED**

Run:
```bash
node tests/web/v5-class-catalog.test.cjs
node tests/web/web-time-students-import.test.cjs
```
Expected: FAIL because V4 still exposes G1-G10 and current importer parses numeric-family labels.

- [ ] **Step 3: Implement V5 catalog behavior**

In `class-structure-pdf.js`:
- remove local A-E mapping duplication and delegate to `FSTTPReference`;
- render PC1-A correctly;
- expose G1-G4 only;
- keep four deterministic group styles;
- keep class PDF generation and historical grade preservation;
- show student move/delete controls only for Admin.

In `student-management.js`:
- all authenticated teachers may read the class/group layout only if the UI exposes that view;
- mutation controls and `changeStudentGroup` require `FSTAccessControl.isAdmin()` client-side in addition to server RLS;
- non-admin call attempts return false and show `Gestion des étudiants réservée à l’administrateur.`.

In `student-import.js`, parse class labels using:

```js
/^MPI1-([A-E])$/
/^PC1-A$/
```

Map A-E internally to class numbers 1-5. Reject PC letters other than A and group numbers outside 1-4. Keep ArrayBuffer/UTF-8 fatal/Windows-1252 fallback, quote handling, delimiter detection, NUL/control stripping, and SheetJS behavior unchanged.

In `access-control.js`, stop treating class ownership as permission to edit classes/students. Introduce:

```js
function canAdministerAcademicData(){ return isAdmin(); }
```

and use it for class/student add/delete flows. Session ownership remains based on `session.teacherId`.

- [ ] **Step 4: Run and verify GREEN**

Run:
```bash
node tests/web/v5-class-catalog.test.cjs
node tests/web/web-time-students-import.test.cjs
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/class-structure-pdf.js web/student-management.js web/student-import.js web/access-control.js tests/web/web-time-students-import.test.cjs tests/web/v5-class-catalog.test.cjs
git commit -m "feat: align classes groups and import with V5"
```

---

### Task 4: Build the pure planning model and workload/conflict analysis

**Files:**
- Create: `web/planning-model.js`
- Create: `tests/web/planning-model.test.cjs`

**Interfaces:**
- Consumes: official slots from `FSTTPReference.generateAlternatingSlots` and existing class/group rows.
- Produces: `FSTPlanningModel.expandDefaultPlans(slots,classes)`, `weeklyLoad(plans)`, `detectConflicts(plans)`, `weekKey(date)`, `canStart(plan)`.

- [ ] **Step 1: Write failing planning tests**

Cover:
1. only existing G1-G3/G4 rows are expanded;
2. every generated row starts `status:'undefined'`, `manipulation:null`, `teacherId:null`;
3. M1-M6 are accepted and M7 rejected by `isManipulation`;
4. `weeklyLoad` counts each planned group row assigned to a teacher;
5. 2 rows gives target, 3 rows gives over-target warning;
6. overlapping time windows for the same teacher on the same date produce a conflict;
7. `pause` and `undefined` cannot start.

Example:

```js
test('workload target is two group-sessions per week',()=>{
  const p=load();
  const rows=[
    {date:'2026-09-14',start:'13:45',end:'18:00',teacherId:'t1',status:'planned'},
    {date:'2026-09-17',start:'13:45',end:'17:30',teacherId:'t1',status:'planned'},
    {date:'2026-09-18',start:'13:30',end:'17:30',teacherId:'t1',status:'planned'}
  ];
  const loadMap=p.weeklyLoad(rows);
  assert.equal(loadMap['2026-09-14'].t1.count,3);
  assert.equal(loadMap['2026-09-14'].t1.state,'over');
});
```

- [ ] **Step 2: Run and verify RED**

Run:
```bash
node tests/web/planning-model.test.cjs
```
Expected: FAIL because module is missing.

- [ ] **Step 3: Implement the pure model**

`expandDefaultPlans` matches each official class family to existing class/group rows and returns one planning row per existing group. It never invents G4 when only G1-G3 exist.

Conflict rule: same teacher, same date, and intervals overlap when `startA < endB && startB < endA`. Ignore unassigned, pause, undefined, and soft-deleted rows.

`weeklyLoad` groups Monday-Sunday by the Monday date string and returns `{count,state}` where state is `under` for 0-1, `target` for 2, `over` for >2.

- [ ] **Step 4: Run and verify GREEN**

Run:
```bash
node tests/web/planning-model.test.cjs
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/planning-model.js tests/web/planning-model.test.cjs
git commit -m "feat: add V5 planning model"
```

---

### Task 5: Integrate plans into online data, realtime, teacher directory, and session lifecycle

**Files:**
- Create: `web/planning-runtime.js`
- Modify: `web/access-control.js`
- Modify: `web/online-runtime.js`
- Modify: `web/session-permissions.js`
- Modify: `tests/web/access-control.test.cjs`
- Modify: `tests/web/session-editing.test.cjs`
- Create: `tests/web/planning-runtime.test.cjs`

**Interfaces:**
- Consumes: Supabase `session_plans`, `teacher_directory`, `start_session_plan`, existing `data`, `FSTAccessControl`, `FSTSessionPermissions`.
- Produces: `data.sessionPlans`, `FSTPlanningRuntime.listTeachers()`, `savePlanPatch(id,patch)`, `materializeDefaultPlan()`, `startPlan(id)`, `canEditPlan()`, `canStartPlan(plan)`.

- [ ] **Step 1: Write failing runtime contract tests**

Assert that:
- `access-control.js` fetches `session_plans` for all authenticated users;
- student query is not filtered by legacy `teacher_id` client filter; RLS decides visibility;
- `online-runtime.js` realtime table list includes `session_plans`;
- planning writes are guarded with `isAdmin()`;
- `startPlan` calls `rpc('start_session_plan',{p_plan_id:...})`;
- `session-permissions.js` still allows grade after closure for owner/admin and blocks attendance/comment after closure.

- [ ] **Step 2: Run and verify RED**

Run:
```bash
node tests/web/planning-runtime.test.cjs
node tests/web/access-control.test.cjs
node tests/web/session-editing.test.cjs
```
Expected: planning-runtime contract fails.

- [ ] **Step 3: Extend remote mapping**

In `access-control.js`, map `session_plans` rows to:

```js
{
  id,
  academicYearId,
  classId,
  teacherId,
  date,
  start,
  end,
  module,
  manipulation,
  status,
  sessionId,
  revision,
  deletedAt
}
```

`fetchRemoteData()` queries all plans because RLS allows all authenticated users to SELECT. Teacher student query becomes an unrestricted `.select('*')`; server RLS limits rows to rosters relevant to assigned planned/real sessions. Admin still sees all.

- [ ] **Step 4: Add runtime operations**

`planning-runtime.js`:
- `listTeachers()` calls `teacher_directory`, deduplicates `{id,name}` and sorts by French locale;
- `savePlanPatch` rejects non-admin in client before calling Supabase update;
- allowed patch keys are exactly `teacher_id`, `manipulation`, `status`, `plan_date`, `start_time`, `end_time`;
- manipulation validates null or M1-M6;
- status validates planned/pause/undefined;
- pause/undefined clears neither historical `session_id` nor completed data; it must reject status changes that would invalidate an already materialized/completed real session and tell Admin to keep the historical row;
- `materializeDefaultPlan()` builds missing rows for the active academic year and existing groups, using `upsert(...,{onConflict:'class_id,plan_date',ignoreDuplicates:true})`;
- `startPlan(id)` only offers action to assigned teacher or Admin and uses the RPC, then refreshes authoritative state and opens the returned real session.

`online-runtime.js` adds `session_plans` to realtime subscriptions.

- [ ] **Step 5: Re-run runtime and existing permission tests**

Run:
```bash
node tests/web/planning-runtime.test.cjs
node tests/web/access-control.test.cjs
node tests/web/session-editing.test.cjs
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/planning-runtime.js web/access-control.js web/online-runtime.js web/session-permissions.js tests/web/planning-runtime.test.cjs tests/web/access-control.test.cjs tests/web/session-editing.test.cjs
git commit -m "feat: connect V5 planning to realtime sessions"
```

---

### Task 6: Add the official timetable and dated planning UI

**Files:**
- Create: `web/planning-ui.js`
- Create: `tests/web/planning-ui.test.cjs`

**Interfaces:**
- Consumes: `FSTTPReference`, `FSTPlanningModel`, `FSTPlanningRuntime`, `FSTAccessControl`, global `data` and current user.
- Produces: official timetable section inside `#emploi`, a new `Planning des séances` tab, views General/Class/Teacher/Workload, and Admin edit controls.

- [ ] **Step 1: Write failing DOM/source contract tests**

Verify markers:

```js
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('planning UI exposes official timetable, three read views and admin workload view',()=>{
  const js=fs.readFileSync('web/planning-ui.js','utf8');
  for(const marker of [
    'Planning des séances',
    'Emploi du temps officiel TP Physique 2026/2027',
    'Planning général',
    'Par classe / groupe',
    'Par enseignant',
    'Charge enseignants',
    'Rétablir le créneau officiel',
    'M1','M6','Pause','À définir','2/2'
  ]) assert.ok(js.includes(marker),`missing ${marker}`);
});
```

Also test that teacher editing controls are rendered only when `FSTAccessControl.isAdmin()` is true, while all users receive teacher names and full planning rows.

- [ ] **Step 2: Run and verify RED**

Run:
```bash
node tests/web/planning-ui.test.cjs
```
Expected: FAIL because `web/planning-ui.js` is missing.

- [ ] **Step 3: Implement official timetable integration**

On initialization:
- change `#emploi h2` from `Mon emploi du temps` to `Emploi du temps TP Physique`;
- prepend an `Emploi du temps officiel TP Physique 2026/2027` table with six class rows;
- keep actual class/group overrides below it;
- official table is read-only for everybody.

In Classes & Groupes:
- track/class changes call `FSTTPReference.applyOfficialToForm()`;
- module field is set to `TP Physique` and `readOnly=true`;
- day/start/end remain editable;
- reset button restores official day/start/end.

- [ ] **Step 4: Implement the planning tab and views**

Dynamically insert a nav button beside Emploi du temps and a `#planning-seances` tab-content section so the canonical HTML need not be manually forked.

Planning row visible columns:
`Semaine | Date | Jour | Classe | Groupe | Début | Fin | Module | Manip | Enseignant | Statut | Action`.

All teachers can switch between:
1. Planning général;
2. Par classe / groupe;
3. Par enseignant.

Admin additionally sees:
4. Charge enseignants.

Teacher rows for other teachers are read-only. Rows assigned to the current teacher show `Ma séance` and, if status is planned, a `Saisir présence et notes` / `Ouvrir la séance` action.

Admin gets native selects for M1-M6/unassigned, teacher, and status; date/start/end inputs; and buttons:
- `Générer / compléter le planning`;
- `Marquer cette semaine en pause`;
- `Mettre cette semaine à définir`.

Weekly bulk state updates apply to all planning rows whose Monday week key matches the selected week. They never delete rows.

- [ ] **Step 5: Implement workload/conflict display**

For each teacher/week show text, not color alone:
- `0/2 — sous la cible`;
- `1/2 — sous la cible`;
- `2/2 — cible atteinte`;
- `3/2 — dépassement`.

Conflict rows show a visible warning icon/text `Conflit horaire` and do not auto-reassign.

- [ ] **Step 6: Run and verify GREEN**

Run:
```bash
node tests/web/planning-ui.test.cjs
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add web/planning-ui.js tests/web/planning-ui.test.cjs
git commit -m "feat: add V5 timetable and planning UI"
```

---

### Task 7: Preserve session/PDF behavior and add planning-aware report context

**Files:**
- Modify: `web/report-pdf.js`
- Modify: `web/class-structure-pdf.js`
- Modify: `web/session-editing.js`
- Create: `tests/web/v5-reports.test.cjs`

**Interfaces:**
- Consumes: real sessions and attendance; optional linked planning row for manipulation/assigned teacher context.
- Produces: unchanged raw-grade class PDF semantics plus manipulation/teacher context in session reports when available.

- [ ] **Step 1: Write failing report tests**

Test source/pure model behavior:
- class PDF header remains `Nom | Prénom | Groupe | Notes par séance | Moyenne /20`;
- missing grades display `—`;
- historical grade remains visible after a student changes current group;
- average uses only numeric entered grades;
- session report can show `Manipulation : Mx` when a linked plan exists;
- completed teacher session still has grade input enabled but attendance/comment locked.

- [ ] **Step 2: Run and verify RED only for new planning context**

Run:
```bash
node tests/web/v5-reports.test.cjs
```
Expected: FAIL because planning context is not yet included.

- [ ] **Step 3: Implement minimal planning context without changing grade semantics**

In `report-pdf.js`, find the plan by `sessionId` and include manipulation and assigned teacher in session report header when present. Do not source grades from planning; grades remain exclusively attendance records.

In `class-structure-pdf.js`, keep all raw grades plus average. Use `FSTTPReference.classLabel` for MPI/PC names.

In `session-editing.js`, use existing `FSTSessionPermissions` matrix unchanged for completed sessions:
- Admin: all editable;
- assigned teacher before closure: attendance/comment/grade;
- assigned teacher after closure: grade only;
- foreign teacher: read-only/no mutation.

- [ ] **Step 4: Run report and permission regression tests**

Run:
```bash
node tests/web/v5-reports.test.cjs
node tests/web/session-editing.test.cjs
node tests/web/attendance-policy.test.cjs
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/report-pdf.js web/class-structure-pdf.js web/session-editing.js tests/web/v5-reports.test.cjs
git commit -m "feat: add planning context to V5 reports"
```

---

### Task 8: Wire V5 modules into the standalone build and produce the final HTML

**Files:**
- Modify: `scripts/build_single_file_release.py`
- Modify: `.github/workflows/build-web.yml`
- Modify: `tests/web/web-time-students-import.test.cjs`
- Create: `tests/web/v5-build-contract.test.cjs`

**Interfaces:**
- Consumes: all V5 Web modules.
- Produces: `web/index.html` and `dist/web/Gestion-Presence-FST-Web-2026-2027.html` with all V5 behavior in one release file.

- [ ] **Step 1: Write failing build contract test**

Require build script markers:

```js
for(const marker of [
  'tp-reference.js',
  'planning-model.js',
  'planning-runtime.js',
  'planning-ui.js',
  'data-fst-tp-reference="inline"',
  'data-fst-planning-model="inline"',
  'data-fst-planning-runtime="inline"',
  'data-fst-planning-ui="inline"',
  'Planning des séances',
  'session_plans'
]) assert.ok(py.includes(marker),`missing ${marker}`);
```

- [ ] **Step 2: Run and verify RED**

Run:
```bash
node tests/web/v5-build-contract.test.cjs
```
Expected: FAIL because V5 modules are not in the builder.

- [ ] **Step 3: Update build order**

Inline in this dependency order:
1. PDF/XLSX engines;
2. `time-format.js`;
3. `tp-reference.js`;
4. current online/security/access/attendance/session modules;
5. student import/management;
6. `class-structure-pdf.js`;
7. `planning-model.js`;
8. `planning-runtime.js`;
9. `planning-ui.js`;
10. time integration/statistics/report modules, with any module that overrides earlier functions placed after the definitions it intentionally wraps.

Add final artifact marker assertions for `FSTTPReference`, `FSTPlanningModel`, `FSTPlanningRuntime`, `FSTPlanningUI`, `session_plans`, `MPI1-A`, `PC1-A`, `M6`, `Pause`, `Moyenne /20`.

Update workflow branch trigger to include `feat/web-v5-planning` while V5 is under validation; restore normal release branches before final merge if desired.

- [ ] **Step 4: Run all JavaScript syntax/tests**

Run:
```bash
set -euo pipefail
for f in web/*.js; do node --check "$f"; done
for test in tests/web/*.test.cjs; do node "$test"; done
```
Expected: all exit 0.

- [ ] **Step 5: Build the Web application and standalone release**

Run:
```bash
python scripts/build_online_web.py
python scripts/build_single_file_release.py
```
Expected: both exit 0 and print `web/index.html`.

- [ ] **Step 6: Verify the final HTML contract**

Run:
```bash
set -euo pipefail
test -s web/index.html
grep -Fq 'data-fst-planning-ui="inline"' web/index.html
grep -Fq 'Planning des séances' web/index.html
grep -Fq 'MPI1-A' web/index.html
grep -Fq 'PC1-A' web/index.html
grep -Fq 'Moyenne /20' web/index.html
grep -Fq 'XLSX.read' web/index.html
grep -Fq 'grade_only' web/index.html
! grep -Fq 'Array.from({length:10}' web/index.html
```
Expected: exit 0.

- [ ] **Step 7: Run live Supabase smoke checks**

With Admin:
- generate missing planning rows;
- assign M1-M6 and teachers;
- mark one future week pause then restore planned;
- confirm >2 workload is warning only;
- confirm overlapping teacher assignment shows conflict warning;
- create a new teacher account and confirm it appears in assignment dropdown.

With Teacher A:
- read all planning and all teacher schedules;
- fail to edit any planning/class/student row;
- start only a plan assigned to Teacher A;
- enter presence/comment/grade;
- close session;
- confirm attendance/comment lock and grade remains editable.

With Teacher B:
- read Teacher A planning;
- fail to start/edit Teacher A session.

- [ ] **Step 8: Produce the named V5 artifact and checksum**

Copy:
```bash
cp web/index.html /mnt/data/Gestion_Presence_FST_TP_MPI_PC_WEB_V5.html
sha256sum /mnt/data/Gestion_Presence_FST_TP_MPI_PC_WEB_V5.html
```

Record the exact SHA-256 in the completion response.

- [ ] **Step 9: Commit**

```bash
git add scripts/build_single_file_release.py .github/workflows/build-web.yml tests/web/web-time-students-import.test.cjs tests/web/v5-build-contract.test.cjs
git commit -m "build: produce Web V5 planning release"
```

---

## Final Verification Checklist

Before claiming V5 complete, run fresh evidence for every item:

```bash
set -euo pipefail
for f in web/*.js; do node --check "$f"; done
for test in tests/web/*.test.cjs; do node "$test"; done
python scripts/build_online_web.py
python scripts/build_single_file_release.py
test -s web/index.html
grep -Fq 'data-fst-planning-ui="inline"' web/index.html
grep -Fq 'Planning des séances' web/index.html
grep -Fq 'TP Physique' web/index.html
grep -Fq 'MPI1-E' web/index.html
grep -Fq 'PC1-A' web/index.html
grep -Fq 'M6' web/index.html
grep -Fq 'grade_only' web/index.html
grep -Fq 'XLSX.read' web/index.html
```

Then verify the live Supabase schema/RLS/RPC and the three-role smoke matrix described in Task 8. Do not claim full completion if local tests pass but live RLS/RPC checks have not been exercised.
