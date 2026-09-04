# V16 Official Planning and Dashboard Notices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current V16 planning assumptions with the approved 2026/2027 calendar and manual Admin assignment workflow, enforce weekly teacher/manipulation/room rules in Supabase, preserve TEST/REAL isolation, and display the corrected MPI1/PC1 notices on Dashboard.

**Architecture:** Keep V5.13 attendance behavior and legacy V5.15 APIs intact, but make V16 own the authoritative displayed planning and all new manual editing. Add a V16 transactional week-save RPC rather than extending legacy `v515_assign_teacher`, because the legacy RPC hard-codes manipulation rotation, teacher/manipulation restrictions, and semester quota logic that no longer matches the approved rules. Use browser-side draft state for incomplete room choices; only complete, valid weeks are persisted to REAL or TEST.

**Tech Stack:** Vanilla JavaScript modules, Node 22 `node:test`, Python 3.12 build scripts, Supabase PostgreSQL migrations/RPCs/RLS, standalone private HTML build.

**Spec:** `docs/superpowers/specs/2026-09-04-v16-official-planning-dashboard-notices-design.md`

## Global Constraints

- Repository stays private; do not restore GitHub Pages.
- Monday: 13:45–17:30. Thursday: 13:30–17:30. Friday: 13:30–17:30.
- 15/10/2026 is a public holiday with no TP.
- 02/11/2026–08/11/2026 is DS/no TP.
- Normal week: exactly 4 distinct teachers/day and exactly 2 teaching days for each of the 6 teachers.
- Holiday-reduced week: exactly 4 distinct teachers/day with teacher-day distribution `2,2,1,1,1,1`; Admin chooses which 2 teachers work both days.
- No teacher may exceed 2 teaching days in any week.
- Same manipulation may occur multiple times in one session.
- A class/group may never repeat a manipulation already assigned earlier in the cycle.
- Two simultaneous groups may never use the same room.
- TEST stays Admin-only and isolated; TEST attendance/grades/comments never copy to REAL.
- Do not modify unrelated legacy security warnings or legacy SECURITY DEFINER functions.
- Do not alter V5.13 attendance/grade permissions.
- Production structural data is not changed until the production preflight task passes and the user explicitly approves the production apply step.

---

## File Structure

- `web/v16-planning-data.js` — authoritative V16 calendar and approved default manipulation sequences.
- `web/v16-planning-state.js` — merge persisted teacher/manipulation/room values into the calendar, manage drafts, and expose pure week validation helpers.
- `web/v16-planning-editor.js` — Admin-only inline editor and atomic week save client.
- `web/v16-planning-ui.js` — planning shell/table, REAL/TEST data loading, filtering, read-only teacher view, integration with editor.
- `web/v16-dashboard-notices.js` — corrected MPI1 and PC1 notice cards mounted into Dashboard.
- `web/v16-test-mode.js` — TEST cloning/reset/preview/apply orchestration for all structural fields.
- `supabase/migrations/20260904170000_v16_manual_planning_rules.sql` — schema constraints, history guards, adaptive weekly validator, REAL week-save RPC.
- `supabase/migrations/20260904170100_v16_test_manual_planning.sql` — TEST clone/save support and TEST→REAL structural apply update.
- `supabase/ops/2026-09-04_v16_official_calendar_reconcile.sql` — guarded, manually executed production calendar reconciliation; never auto-deployed as a migration.
- `scripts/build_online_web.py` / `scripts/build_single_file_release.py` — bundle the new editor and dashboard modules.
- `tests/web/v16-planning-data.test.cjs` — exact official calendar contract.
- `tests/web/v16-planning-state.test.cjs` — pure draft/validation behavior.
- `tests/web/v16-planning-editor.test.cjs` — Admin editor/RPC contract.
- `tests/web/v16-dashboard-notices.test.cjs` — corrected notice content and Dashboard mounting.
- `tests/web/v16-test-mode.test.cjs` — TEST structural field contract.
- `tests/web/v16-manual-planning-sql.test.cjs` — static SQL security/constraint contract.
- `tests/web/v16-release-contract.test.cjs` — final standalone bundle contract.

---

### Task 1: Make V16 planning data authoritative

**Files:**
- Modify: `web/v16-planning-data.js`
- Test: `tests/web/v16-planning-data.test.cjs`

**Interfaces:**
- Produces: `V16PlanningData.rows()` returning `{date, weekday, start, end, className, isTeachingSession, reason, groups[]}`.
- Each teaching `groups[]` item is `{groupNo, manipulation, room}`; `room` is `null` in the unsaved V16 seed so the Admin must make an explicit room choice and no legacy manipulation→room collision is silently accepted.
- Consumers: `V16PlanningState.createPlanningState()` and exports through `V16PlanningUI`.

- [ ] **Step 1: Extend the failing data tests with the exact calendar and sequences**

```js
const rows = api.rows();
const byDate = date => rows.find(r => r.date === date);
const manips = date => byDate(date).groups.map(g => g.manipulation);

test('15 October is a public holiday without TP', () => {
  const row = byDate('2026-10-15');
  assert.equal(row.isTeachingSession, false);
  assert.equal(row.className, null);
  assert.match(row.reason, /f[eé]ri[eé]|Evacuation/i);
});

test('approved slots are exact', () => {
  assert.deepEqual([byDate('2026-09-14').start, byDate('2026-09-14').end], ['13:45','17:30']);
  assert.deepEqual([byDate('2026-09-17').start, byDate('2026-09-17').end], ['13:30','17:30']);
  assert.deepEqual([byDate('2026-09-18').start, byDate('2026-09-18').end], ['13:30','17:30']);
});

test('MPI1-A approved six occurrences are preserved', () => {
  assert.deepEqual(manips('2026-09-14'), ['M1','M2','M3','M4']);
  assert.deepEqual(manips('2026-09-28'), ['M2','M3','M4','M1']);
  assert.deepEqual(manips('2026-10-12'), ['M3','M4','M1','M2']);
  assert.deepEqual(manips('2026-10-26'), ['M4','M1','M2','M3']);
  assert.deepEqual(manips('2026-11-16'), ['M5','M6','M5','M6']);
  assert.deepEqual(manips('2026-11-30'), ['M6','M5','M6','M5']);
});

test('Thursday alternation skips the holiday without advancing class occurrence', () => {
  assert.equal(byDate('2026-10-22').className, 'MPI1-C');
  assert.deepEqual(manips('2026-10-22'), ['M3','M4','M1','M2']);
  assert.equal(byDate('2026-10-29').className, 'MPI1-D');
  assert.deepEqual(manips('2026-10-29'), ['M3','M4','M1','M2']);
});

test('there are 32 teaching sessions and DS days are non-teaching', () => {
  assert.equal(rows.filter(r => r.isTeachingSession).length, 32);
  for (const date of ['2026-11-02','2026-11-05','2026-11-06']) {
    assert.equal(byDate(date).isTeachingSession, false);
  }
});
```

- [ ] **Step 2: Run the data test and confirm RED**

Run: `node tests/web/v16-planning-data.test.cjs`

Expected: failures for 15/10, the Thursday post-holiday sequence, end-of-cycle M5/M6 patterns, and/or room defaults.

- [ ] **Step 3: Replace the `thursdayFix` patch with explicit V16 occurrence patterns**

Use these exact V16 patterns:

```js
const occurrencePatterns = Object.freeze([
  ['M1','M2','M3','M4'],
  ['M2','M3','M4','M1'],
  ['M3','M4','M1','M2'],
  ['M4','M1','M2','M3'],
  ['M5','M6','M5','M6'],
  ['M6','M5','M6','M5']
]);
```

Build V16 rows from the approved date/class occurrence table instead of rewriting only Thursdays. For non-teaching rows return `groups: []`. For teaching rows return:

```js
groups: occurrencePatterns[occurrence - 1].map((manipulation, index) => ({
  groupNo: index + 1,
  manipulation,
  room: null
}))
```

Do not mutate `web/v515-planning-2026-2027.js`; V5.15 remains a legacy reference.

- [ ] **Step 4: Run the data test and syntax check**

Run:

```bash
node --check web/v16-planning-data.js
node tests/web/v16-planning-data.test.cjs
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add web/v16-planning-data.js tests/web/v16-planning-data.test.cjs
git commit -m "feat(v16): align planning with approved 2026 calendar"
```

---

### Task 2: Enforce manual planning rules in Supabase

**Files:**
- Create: `supabase/migrations/20260904170000_v16_manual_planning_rules.sql`
- Create: `tests/web/v16-manual-planning-sql.test.cjs`

**Interfaces:**
- Replaces behavior of: `public.v16_verify_teacher_week(date,text)` while preserving its signature.
- Produces: `public.v16_save_week_plan(date,jsonb,text)` returning `{ok, code?, message?, week_start, context, changed_assignments, blockers}`.
- Does not modify legacy `public.v515_assign_teacher` or other legacy SECURITY DEFINER functions.

- [ ] **Step 1: Write a failing static SQL contract test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = 'supabase/migrations/20260904170000_v16_manual_planning_rules.sql';
const sql = fs.existsSync(path) ? fs.readFileSync(path,'utf8') : '';

test('manual planning migration removes same-session manipulation uniqueness', () => {
  assert.match(sql, /drop constraint if exists v515_assignments_session_id_manipulation_code_key/i);
  assert.match(sql, /drop constraint if exists v16_test_assignments_test_session_id_manipulation_code_key/i);
});

test('manual planning migration keeps room uniqueness and manipulation history server-side', () => {
  assert.match(sql, /v16_assignments_session_room_uidx/i);
  assert.match(sql, /v16_test_assignments_session_room_uidx/i);
  assert.match(sql, /REPEATED_GROUP_MANIPULATION/i);
});

test('week validator supports 3-day, 2-day holiday, and 0-day DS weeks', () => {
  assert.match(sql, /TEACHING_DAY_COUNT_UNSUPPORTED/i);
  assert.match(sql, /HOLIDAY_WEEK_DISTRIBUTION/i);
  assert.match(sql, /TEACHER_WEEKDAY_COUNT/i);
  assert.match(sql, /MAX_TWO_DAYS_PER_TEACHER/i);
});

test('week save is Admin-only security invoker', () => {
  assert.match(sql, /create or replace function public\.v16_save_week_plan/i);
  assert.match(sql, /security invoker/i);
  assert.match(sql, /private\.is_admin\(\)/i);
  assert.match(sql, /revoke execute on function public\.v16_save_week_plan\(date,jsonb,text\) from public,anon/i);
});
```

- [ ] **Step 2: Run the SQL contract test and confirm RED**

Run: `node tests/web/v16-manual-planning-sql.test.cjs`

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Implement schema constraints without weakening room integrity**

The migration must include exactly these constraint changes:

```sql
alter table public.v515_assignments
  drop constraint if exists v515_assignments_session_id_manipulation_code_key;

alter table public.v16_test_assignments
  drop constraint if exists v16_test_assignments_test_session_id_manipulation_code_key;

create unique index if not exists v16_assignments_session_room_uidx
  on public.v515_assignments(session_id, room);

create unique index if not exists v16_test_assignments_session_room_uidx
  on public.v16_test_assignments(test_session_id, room);
```

Before creating the indexes, the migration must raise a descriptive exception if current rows already contain duplicate rooms; do not silently rewrite production rooms inside this schema migration.

- [ ] **Step 4: Add server-side class/group manipulation history triggers**

Create `private.v16_enforce_real_group_manip_history()` and `private.v16_enforce_test_group_manip_history()` as trigger functions. The REAL trigger checks other assignments joined through `v515_sessions` where `(cycle_id, class_name, group_no, manipulation_code)` matches the candidate and `assignment.id <> new.id`. The TEST trigger performs the equivalent check through `v16_test_sessions`.

Raise exactly:

```sql
raise exception using
  errcode = '23514',
  message = 'REPEATED_GROUP_MANIPULATION';
```

Attach each trigger `before insert or update of session_id, group_no, manipulation_code` (TEST: `test_session_id, group_no, manipulation_code`).

- [ ] **Step 5: Replace weekly validation with adaptive week-type logic**

`public.v16_verify_teacher_week(p_week_start date, p_context text default 'real')` must compute the number of teaching dates from sessions, not from assignments.

Required decision table:

```text
teaching_days = 3 -> each teaching date has 4 assignments/4 distinct teachers; all 6 teachers have exactly 2 distinct dates
teaching_days = 2 -> each teaching date has 4 assignments/4 distinct teachers; sorted teacher-day counts must be 2,2,1,1,1,1
teaching_days = 0 -> no assignments in the week; valid DS week
otherwise         -> blocker TEACHING_DAY_COUNT_UNSUPPORTED
always            -> no teacher may exceed 2 distinct teaching dates
```

Return blocker codes `DAY_TEACHER_COUNT`, `TEACHER_DUPLICATE_DAY`, `TEACHER_WEEKDAY_COUNT`, `HOLIDAY_WEEK_DISTRIBUTION`, `MAX_TWO_DAYS_PER_TEACHER`, and `TEACHING_DAY_COUNT_UNSUPPORTED` as applicable.

- [ ] **Step 6: Add atomic `v16_save_week_plan`**

Signature:

```sql
create or replace function public.v16_save_week_plan(
  p_week_start date,
  p_rows jsonb,
  p_context text default 'real'
) returns jsonb
language plpgsql
security invoker
set search_path='';
```

Each `p_rows` element must have this exact shape:

```json
{"session_id":"uuid","group_no":1,"teacher_id":"uuid","manipulation_code":"M1","room":"A"}
```

For `p_context='real'`, parse rows with `jsonb_to_recordset`, lock affected sessions/assignments, reject sessions already started/completed using `Africa/Tunis`, require exactly 4 rows for every teaching session in the week, require room in `A/B/C/D`, reject duplicate room, then update existing `v515_assignments` by `(session_id,group_no)`. Set `source='admin_direct'`, `request_id=null`, `assigned_by=auth.uid()`.

After staging updates in the transaction, call:

```sql
v_check := public.v16_verify_teacher_week(p_week_start, 'real');
if not coalesce((v_check->>'ok')::boolean,false) then
  raise exception 'V16_WEEK_VALIDATION_FAILED:%', v_check::text;
end if;
```

Audit once per successful week with event `v16_manual_week_plan_saved` and before/after JSON in `context`.

For `p_context='test'`, return `TEST_CONTEXT_USE_TEST_RPC`; Task 3 adds the TEST equivalent so REAL logic stays simple and auditable.

- [ ] **Step 7: Run SQL contract tests**

Run:

```bash
node tests/web/v16-manual-planning-sql.test.cjs
```

Expected: PASS.

- [ ] **Step 8: Commit Task 2**

```bash
git add supabase/migrations/20260904170000_v16_manual_planning_rules.sql tests/web/v16-manual-planning-sql.test.cjs
git commit -m "feat(v16): enforce manual weekly planning rules"
```

---

### Task 3: Extend TEST mode to teacher + manipulation + room

**Files:**
- Create: `supabase/migrations/20260904170100_v16_test_manual_planning.sql`
- Modify: `web/v16-test-mode.js`
- Test: `tests/web/v16-test-mode.test.cjs`
- Test: `tests/web/v16-manual-planning-sql.test.cjs`

**Interfaces:**
- Produces RPC: `public.v16_clone_real_to_test(date)`.
- Produces RPC: `public.v16_save_test_week_plan(date,jsonb)`.
- Replaces `public.v16_apply_test_teacher_plan(date)` implementation while preserving the existing function name for compatibility; it now applies teacher, manipulation and room.

- [ ] **Step 1: Add failing TEST-mode contract tests**

Assert that `web/v16-test-mode.js` requests all three structural fields:

```js
assert.match(source, /teacher_id,group_no,manipulation_code,room/);
assert.match(source, /v16_clone_real_to_test/);
assert.match(source, /v16_apply_test_teacher_plan/);
```

Extend the SQL contract test to require `v16_save_test_week_plan`, `v16_clone_real_to_test`, and updates of `teacher_id`, `manipulation_code`, and `room` in TEST→REAL apply.

- [ ] **Step 2: Run TEST-mode tests and confirm RED**

Run:

```bash
node tests/web/v16-test-mode.test.cjs
node tests/web/v16-manual-planning-sql.test.cjs
```

Expected: FAIL on missing clone/save structural behavior.

- [ ] **Step 3: Implement `v16_clone_real_to_test`**

The RPC is Admin-only SECURITY INVOKER. In one transaction it clears existing TEST attendance/assignments/sessions/scenarios, then copies REAL sessions on/after `p_effective_date` into `v16_test_sessions`, preserving `real_session_id`. It copies corresponding REAL assignments into `v16_test_assignments`, preserving `real_assignment_id`, `group_no`, `teacher_id`, `manipulation_code`, and `room`.

Do not copy attendance, grades or comments.

- [ ] **Step 4: Implement `v16_save_test_week_plan`**

Use the same `p_rows` JSON schema as REAL. Validate four groups/session, distinct rooms, non-repeating class/group manipulation, 4 teachers/day, adaptive 3-day/2-day/0-day week distribution, and max two days/teacher. Update only TEST tables.

- [ ] **Step 5: Upgrade TEST→REAL apply**

Keep the public function name `v16_apply_test_teacher_plan(date)` so the current frontend contract remains stable, but apply all three fields:

```sql
set teacher_id = ta.teacher_id,
    manipulation_code = ta.manipulation_code,
    room = ta.room,
    source = 'admin_direct',
    request_id = null,
    assigned_by = auth.uid()
```

Only future/not-started REAL assignments may change. Re-run the REAL week validator for every affected week before commit. Synchronize mapped legacy `session_plans.teacher_id` as today; do not copy TEST attendance/grades/comments.

- [ ] **Step 6: Update `web/v16-test-mode.js` reset and preview**

`resetTest()` becomes reset + clone from REAL using the chosen/effective date; `previewApply()` selects:

```js
c.from('v16_test_assignments').select('teacher_id,group_no,manipulation_code,room,test_session_id,real_assignment_id')
```

and the corresponding REAL fields. Preview summaries report structural changes, not only row counts.

- [ ] **Step 7: Run TEST-mode and SQL tests**

Run:

```bash
node --check web/v16-test-mode.js
node tests/web/v16-test-mode.test.cjs
node tests/web/v16-manual-planning-sql.test.cjs
```

Expected: PASS.

- [ ] **Step 8: Commit Task 3**

```bash
git add supabase/migrations/20260904170100_v16_test_manual_planning.sql web/v16-test-mode.js tests/web/v16-test-mode.test.cjs tests/web/v16-manual-planning-sql.test.cjs
git commit -m "feat(v16): extend TEST planning to manipulation and room"
```

---

### Task 4: Build the Admin manual planning editor

**Files:**
- Create: `web/v16-planning-editor.js`
- Modify: `web/v16-planning-state.js`
- Modify: `web/v16-planning-ui.js`
- Modify: `web/v16-teacher-permutations.js` only to stop mounting the obsolete swap panel once the manual editor is active; preserve module compatibility.
- Modify: `tests/web/v16-planning-state.test.cjs`
- Create: `tests/web/v16-planning-editor.test.cjs`
- Modify: `tests/web/v16-planning-ui.test.cjs`

**Interfaces:**
- `V16PlanningState.createPlanningState(rows, assignments)` merges persisted `teacherId`, `manipulation`, `room`, and `sessionId`.
- `V16PlanningState.validateWeek(rows, teachers)` returns `{ok, blockers, distribution}`.
- `V16PlanningEditor.render(options)` renders Admin controls.
- `V16PlanningEditor.saveDirtyWeeks()` calls `v16_save_week_plan` in REAL and `v16_save_test_week_plan` in TEST.

- [ ] **Step 1: Write failing state tests for structural merge and week rules**

```js
const state = api.createPlanningState(seedRows, [{
  date:'2026-09-14', className:'MPI1-A', groupNo:1,
  sessionId:'s1', teacherId:'t1', manipulation:'M4', room:'B'
}]);
const g1 = state.rows[0].groups[0];
assert.equal(g1.teacherId,'t1');
assert.equal(g1.manipulation,'M4');
assert.equal(g1.room,'B');
assert.equal(g1.sessionId,'s1');
```

Add pure validation fixtures for:
- normal week with six teacher counts `2,2,2,2,2,2` → valid;
- holiday week counts `2,2,1,1,1,1` → valid;
- teacher with 3 days → `MAX_TWO_DAYS_PER_TEACHER`;
- duplicate room within a session → `ROOM_TIME_CONFLICT`;
- repeated `(className,groupNo,manipulation)` across two dates → `REPEATED_GROUP_MANIPULATION`.

- [ ] **Step 2: Write failing editor/UI contract tests**

Require Admin-only selects and save controls:

```js
assert.match(editorSource, /data-v16-edit-teacher/);
assert.match(editorSource, /data-v16-edit-manipulation/);
assert.match(editorSource, /data-v16-edit-room/);
assert.match(editorSource, /À choisir/);
assert.match(editorSource, /v16_save_week_plan/);
assert.match(editorSource, /v16_save_test_week_plan/);
assert.match(editorSource, /canUseAdminControls/);
```

Require teacher mode to remain read-only.

- [ ] **Step 3: Run focused tests and confirm RED**

Run:

```bash
node tests/web/v16-planning-state.test.cjs
node tests/web/v16-planning-editor.test.cjs
node tests/web/v16-planning-ui.test.cjs
```

Expected: FAIL.

- [ ] **Step 4: Extend planning state merge**

Change `createPlanningState` so persisted values override seed values independently:

```js
const persisted = map.get(assignmentKey(row.date,row.className,group.groupNo));
return {
  ...group,
  sessionId: persisted?.sessionId || group.sessionId || null,
  teacherId: persisted?.teacherId || null,
  manipulation: persisted?.manipulation || group.manipulation,
  room: persisted?.room ?? group.room ?? null
};
```

Add pure `validateWeek` and `validateManipulationHistory` helpers; these mirror server rules for immediate feedback but never replace server validation.

- [ ] **Step 5: Load complete structural assignment data in REAL and TEST**

REAL query in `v16-planning-ui.js`:

```js
client.from('v515_assignments')
  .select('session_id,group_no,teacher_id,manipulation_code,room')
  .eq('cycle_id',cycleId)
```

Map to `{sessionId,date,className,groupNo,teacherId,manipulation,room}`.

TEST query joins `v16_test_assignments` to loaded `v16_test_sessions` and maps the same shape. The selected source is `V16TestMode.getContext()`.

- [ ] **Step 6: Implement inline Admin editor**

For Admin active mode, each teaching group row renders three selects:

```html
<select data-v16-edit-teacher>…six authorised teachers…</select>
<select data-v16-edit-manipulation>
  <option>M1</option><option>M2</option><option>M3</option><option>M4</option><option>M5</option><option>M6</option>
</select>
<select data-v16-edit-room>
  <option value="">À choisir</option><option>A</option><option>B</option><option>C</option><option>D</option>
</select>
```

Teachers see plain text only.

Track dirty ISO weeks. A save action submits the complete four-group payload for every teaching session in each dirty week, never only the currently filtered rows. If client validation fails, show the exact blocker and do not call Supabase.

- [ ] **Step 7: Retire the swap panel from the active UI**

The manual editor supersedes `Permuter les enseignants`. Keep `V16TeacherPermutations` loadable for backward compatibility/tests, but `v16-planning-ui.js` must no longer render its panel when `V16PlanningEditor` is available.

- [ ] **Step 8: Run focused frontend tests**

Run:

```bash
node --check web/v16-planning-state.js
node --check web/v16-planning-editor.js
node --check web/v16-planning-ui.js
node tests/web/v16-planning-state.test.cjs
node tests/web/v16-planning-editor.test.cjs
node tests/web/v16-planning-ui.test.cjs
node tests/web/v16-admin-planning-runtime.test.cjs
```

Expected: PASS.

- [ ] **Step 9: Commit Task 4**

```bash
git add web/v16-planning-editor.js web/v16-planning-state.js web/v16-planning-ui.js web/v16-teacher-permutations.js tests/web/v16-planning-state.test.cjs tests/web/v16-planning-editor.test.cjs tests/web/v16-planning-ui.test.cjs
git commit -m "feat(v16): add Admin manual planning editor"
```

---

### Task 5: Add corrected Avis cards to Dashboard

**Files:**
- Create: `web/v16-dashboard-notices.js`
- Create: `tests/web/v16-dashboard-notices.test.cjs`

**Interfaces:**
- Produces global/module `V16DashboardNotices.mount()`.
- Mount target: `document.getElementById('dashboard')`.
- Idempotent marker: `data-v16-dashboard-notices="true"`.

- [ ] **Step 1: Write failing notice-content tests**

Require these exact corrected values:

```js
for (const marker of [
  'Avis n°1', 'MPI1-A', 'MPI1-E', '13h45',
  'MPI1-C', 'MPI1-D', '13h30',
  'MPI1-B', 'PC1-A',
  'Salles A, B, C et D',
  '11/09/2026', 'Souhail Souai', 'souhail.souai@fst.utm.tn'
]) assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'));

assert.doesNotMatch(source, /PC1-A[^\n]{0,120}13h15/i);
```

- [ ] **Step 2: Run test and confirm RED**

Run: `node tests/web/v16-dashboard-notices.test.cjs`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement two compact permanent cards**

`mount()` must be idempotent and append a section to Dashboard after the existing dashboard summary blocks. The MPI1 card displays Monday 13h45, Thursday 13h30, Friday 13h30. The PC1 card displays Friday 13h30. Both include rooms/location, notice date, coordinator and email.

Do not embed the source DOCX files; the Dashboard shows corrected operational content.

- [ ] **Step 4: Run notice test and syntax check**

Run:

```bash
node --check web/v16-dashboard-notices.js
node tests/web/v16-dashboard-notices.test.cjs
```

Expected: PASS.

- [ ] **Step 5: Commit Task 5**

```bash
git add web/v16-dashboard-notices.js tests/web/v16-dashboard-notices.test.cjs
git commit -m "feat(v16): show corrected TP notices on dashboard"
```

---

### Task 6: Bundle new V16 modules and protect release contracts

**Files:**
- Modify: `scripts/build_online_web.py`
- Modify: `scripts/build_single_file_release.py`
- Modify: `tests/web/v16-release-contract.test.cjs`
- Modify: `tests/web/v16-navigation.test.cjs` only if Dashboard mounting contract requires it.
- Modify: `.github/workflows/build-web.yml` only if an explicit marker must be added; do not re-enable Pages.

**Interfaces:**
- New external module order: state → editor → dashboard notices → planning UI.
- New inline markers: `data-fst-v16-planning-editor="inline"`, `data-fst-v16-dashboard-notices="inline"`.

- [ ] **Step 1: Add failing release assertions**

```js
assert.match(html, /data-fst-v16-planning-editor="inline"/);
assert.match(html, /data-fst-v16-dashboard-notices="inline"/);
assert.match(html, /V16PlanningEditor/);
assert.match(html, /V16DashboardNotices/);
assert.doesNotMatch(html, /<script[^>]+src=["']\.\/v16-planning-editor\.js/);
assert.doesNotMatch(html, /<script[^>]+src=["']\.\/v16-dashboard-notices\.js/);
```

- [ ] **Step 2: Run release test and confirm RED**

Run: `node tests/web/v16-release-contract.test.cjs`

Expected: FAIL.

- [ ] **Step 3: Add module tags to online build**

In `scripts/build_online_web.py`, add:

```python
'<script src="./v16-planning-editor.js"></script>',
'<script src="./v16-dashboard-notices.js"></script>',
```

before `v16-planning-ui.js`.

- [ ] **Step 4: Inline both modules in standalone build**

Add paths, reads, external-module removal entries, inline blocks, and marker assertions for editor/notices in `scripts/build_single_file_release.py`.

- [ ] **Step 5: Run full local Web verification**

Run:

```bash
set -e
for file in web/v515-*.js web/v16-*.js; do node --check "$file"; done
for test in tests/web/*.test.cjs; do node "$test"; done
python scripts/build_online_web.py
python scripts/build_single_file_release.py
test -s web/index.html
grep -Fq 'data-fst-v16-planning-editor="inline"' web/index.html
grep -Fq 'data-fst-v16-dashboard-notices="inline"' web/index.html
grep -Fq '13h30' web/index.html
```

Expected: all commands PASS.

- [ ] **Step 6: Commit Task 6**

```bash
git add scripts/build_online_web.py scripts/build_single_file_release.py tests/web/v16-release-contract.test.cjs tests/web/v16-navigation.test.cjs .github/workflows/build-web.yml
git commit -m "build(v16): bundle manual planning and dashboard notices"
```

Only add files that actually changed; do not create a no-op workflow change.

---

### Task 7: Prepare guarded production calendar reconciliation

**Files:**
- Create: `supabase/ops/2026-09-04_v16_official_calendar_reconcile.sql`
- Create: `tests/web/v16-production-reconcile-sql.test.cjs`

**Interfaces:**
- Operational script only; it is not under `supabase/migrations/` and therefore is never applied automatically.
- Reconciles current REAL V16 calendar/assignments only after production preflight and explicit user approval.

- [ ] **Step 1: Write a failing operational SQL contract test**

Require the script to contain guards for cycle identity, 15/10, started/completed sessions, and rollback-safe transaction boundaries:

```js
assert.match(sql, /begin;/i);
assert.match(sql, /2026-10-15/);
assert.match(sql, /SESSION_ALREADY_STARTED/i);
assert.match(sql, /assignments_finalized/i);
assert.match(sql, /JOUR FERIE/i);
assert.match(sql, /commit;/i);
```

- [ ] **Step 2: Run test and confirm RED**

Run: `node tests/web/v16-production-reconcile-sql.test.cjs`

Expected: FAIL.

- [ ] **Step 3: Write the guarded operational reconciliation**

The script must:
1. resolve the single `2026/2027`, semester 1 cycle;
2. abort unless it exists exactly once;
3. abort if any affected session is already started/completed;
4. abort if attendance/grade/comment records exist for any structural row that would be removed or remapped; the exact legacy tables are determined from the production schema during preflight rather than guessed;
5. convert 15/10 to non-teaching, remove its future-only V16 assignments and mapped legacy plans only when safe;
6. shift Thursday class occurrences after the holiday to the approved sequence without advancing on 15/10;
7. set DS dates 02/11, 05/11, 06/11 to no-TP;
8. preserve Monday/Friday dates and approved class alternation;
9. recreate/update future assignments using the approved manipulations but only after Admin rooms/teachers form a valid weekly plan;
10. call `v16_verify_teacher_week` for every active week before commit;
11. audit event `v16_official_calendar_reconciled`.

Because rooms/teachers are Admin choices, the operational script must not invent replacement rooms or teachers. If the corrected calendar makes an existing future week invalid, it must abort and report the dates requiring Admin completion in TEST first.

- [ ] **Step 4: Run operational SQL contract test**

Run: `node tests/web/v16-production-reconcile-sql.test.cjs`

Expected: PASS.

- [ ] **Step 5: Commit Task 7**

```bash
git add supabase/ops/2026-09-04_v16_official_calendar_reconcile.sql tests/web/v16-production-reconcile-sql.test.cjs
git commit -m "ops(v16): prepare guarded official calendar reconciliation"
```

---

### Task 8: Verification, PR, and production checkpoint

**Files:**
- No new feature files expected.
- Review all changed files from Tasks 1–7.

**Interfaces:**
- Produces a reviewable PR; does not merge or apply production data without explicit approval.

- [ ] **Step 1: Run the complete repository Web verification**

```bash
set -e
for file in web/v515-*.js web/v16-*.js; do node --check "$file"; done
for test in tests/web/*.test.cjs; do node "$test"; done
python scripts/build_online_web.py
python scripts/build_single_file_release.py
```

Expected: PASS.

- [ ] **Step 2: Verify privacy and V5.13 non-regression contracts**

Run focused tests:

```bash
node tests/web/attendance-policy.test.cjs
node tests/web/access-control.test.cjs
node tests/web/v16-admin-planning-runtime.test.cjs
node tests/web/v16-navigation.test.cjs
node tests/web/v16-release-contract.test.cjs
```

Expected: PASS; no GitHub Pages workflow introduced.

- [ ] **Step 3: Open PR from `feature/v16-official-planning-dashboard-notices` to `main`**

PR body must summarize:
- official calendar/time corrections;
- 15/10 holiday and DS week;
- manual teacher/manipulation/room editor;
- adaptive weekly teacher validation;
- same-manipulation/different-room support;
- strict class/group no-repeat manipulation;
- TEST structural planning;
- Dashboard notices;
- production reconciliation intentionally not auto-applied.

- [ ] **Step 4: Wait for GitHub Actions `Build Secure Web Application`**

Expected: SUCCESS and artifact `Gestion-Presence-FST-Web-V16-candidate` produced.

- [ ] **Step 5: Production preflight using the connected Supabase project `dbslzmvzbxczpqyektpx`**

Read-only checks before any write:

```sql
select id,status,academic_year,semester
from public.v515_cycles
where academic_year='2026/2027' and semester=1;

select session_date,class_name,is_teaching_session,lifecycle_status,start_time,end_time
from public.v515_sessions
where cycle_id=(select id from public.v515_cycles where academic_year='2026/2027' and semester=1 limit 1)
order by session_date;

select s.session_date,count(a.id) assignments,count(distinct a.teacher_id) teachers,count(distinct a.room) rooms
from public.v515_sessions s
left join public.v515_assignments a on a.session_id=s.id
where s.cycle_id=(select id from public.v515_cycles where academic_year='2026/2027' and semester=1 limit 1)
group by s.session_date
order by s.session_date;
```

Also inspect the actual production schema/tables that hold attendance, grades and comments and verify zero affected historical data before running the ops reconciliation.

- [ ] **Step 6: Stop and request explicit user approval before either action**

Do not merge the PR and do not execute `supabase/ops/2026-09-04_v16_official_calendar_reconcile.sql` until the user approves after seeing CI and preflight results.

- [ ] **Step 7: After approval, merge first, deploy schema migrations, smoke-test RPCs, then apply the guarded ops reconciliation**

Required smoke cases:
- Admin valid normal week → `ok=true`;
- Admin valid holiday week distribution `2,2,1,1,1,1` → `ok=true`;
- teacher 3 days → blocked;
- duplicate room → blocked;
- duplicate manipulation in two groups with different rooms → allowed;
- repeated manipulation for same class/group → blocked;
- teacher account calling save → `FORBIDDEN`;
- TEST save changes structural fields only;
- TEST→REAL refuses started/completed session;
- Dashboard displays corrected notices in the standalone artifact.

- [ ] **Step 8: Produce the final private standalone HTML and checksum**

Build from merged `main`, verify no external V16 script references remain, calculate SHA-256, and deliver the private `.html` artifact. Do not publish it on GitHub Pages.

---

## Self-Review

- **Spec coverage:** All calendar, teacher-week, manipulation, room, TEST/REAL, Dashboard, production-safety and privacy requirements have a corresponding task.
- **Legacy isolation:** The plan deliberately avoids changing `v515_assign_teacher` and other legacy SECURITY DEFINER functions; new V16 RPCs own the new rules.
- **Room consistency:** V16 seed rooms are unsaved/`null`; therefore the old M3/M4→D and M5/M6→A mapping cannot violate the new distinct-room rule before Admin explicitly chooses rooms.
- **Teacher quota consistency:** V16 validates weekly day counts and does not use the legacy semester `v515_teacher_constraints.quota`, avoiding the impossible 22-each assumption after removing 15/10.
- **Production safety:** Calendar reconciliation is an operational script, not an auto-run migration, and execution is gated by preflight plus explicit user approval.
- **No placeholders:** Every task identifies exact files, interfaces, test commands, expected behavior and commit boundary.
