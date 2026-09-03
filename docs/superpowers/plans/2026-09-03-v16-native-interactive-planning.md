# V16 Native Interactive Planning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the V5.15 floating planning modal with a native V16 `Planning des séances` tab integrated into the V5.13 interface and backed by the official 2026/2027 rotation.

**Architecture:** Keep the V5.13 HTML as the visual host. Move planning rendering/state into focused V16 modules; preserve existing attendance/grade code. The official schedule remains immutable input, while filters and admin assignment controls are interactive client views over Supabase state.

**Tech Stack:** Vanilla JavaScript, HTML/CSS, Node.js `node:test`, Supabase JS, existing Python Web build.

**Spec:** `docs/superpowers/specs/2026-09-03-v16-planning-design.md`

## Global Constraints

- Navigation order must be exact.
- `Présence` is immediately after `Dashboard`.
- `Planning des séances` is a native top-level tab.
- No V16 floating launcher/modal remains.
- Official dates/rotation/rooms cannot be freely edited.

---

### Task 1: Lock the V16 navigation contract

**Files:**
- Modify: `gestion_presence_tp_theme_institutionnel.html`
- Create: `tests/web/v16-navigation.test.cjs`

**Interfaces:**
- Produces DOM ids: `tab-dashboard`, `tab-attendance`, `tab-planning-v16` and matching content panel `planning-v16`.

- [ ] **Step 1: Write the failing test** asserting the visible nav text order equals `Dashboard, Présence, Classes & Groupes, Emploi du temps, Étudiants, Séances, Planning des séances, Rapports, Administration`, and that no `Planning V5.15` floating launcher exists.
- [ ] **Step 2: Run** `node --test tests/web/v16-navigation.test.cjs` and verify FAIL.
- [ ] **Step 3: Modify the host HTML** by moving the existing Présence tab directly after Dashboard and inserting a V16 planning tab/panel using the existing `.nav-tab`, `.tab-content`, `.form-row`, `.table`, `.btn`, and `.badge` classes.
- [ ] **Step 4: Run** `node --test tests/web/v16-navigation.test.cjs` and verify PASS.
- [ ] **Step 5: Commit** with `git commit -m "feat(v16): integrate planning navigation"`.

### Task 2: Introduce the V16 official planning data adapter

**Files:**
- Create: `web/v16-planning-data.js`
- Create: `tests/web/v16-planning-data.test.cjs`
- Read-only reference: `web/v515-planning-2026-2027.js`

**Interfaces:**
- Produces `V16PlanningData.rows(): PlanningRow[]`.
- `PlanningRow = {date, weekday, start, end, className, isTeachingSession, reason, groups:[{groupNo, manipulation, room}]}`.

- [ ] **Step 1: Write failing tests** for representative official rows: 14/09 MPI1-A, 28/09 MPI1-A, 15/10 holiday, 02/11 rest, and fixed room mapping M1→C, M2→B, M3→D, M4→D, M5→A, M6→A.
- [ ] **Step 2: Run** `node --test tests/web/v16-planning-data.test.cjs` and verify FAIL.
- [ ] **Step 3: Implement** the data adapter by normalizing the already-seeded official calendar/rotation into V16 row objects; do not derive a new rotation algorithm that can diverge from the official source.
- [ ] **Step 4: Run** the focused test and verify PASS.
- [ ] **Step 5: Commit** with `git commit -m "feat(v16): add official planning data adapter"`.

### Task 3: Build the interactive planning state/filter engine

**Files:**
- Create: `web/v16-planning-state.js`
- Create: `tests/web/v16-planning-state.test.cjs`

**Interfaces:**
- Produces `createPlanningState(rows, assignments)`.
- Produces `filterPlanning(state, filters)` with filters `className, groupNo, weekday, week, teacherId, manipulation, room, fromDate, toDate`.
- Produces `planningSummary(filteredRows)` returning `{sessionCount, assignmentCount}`.

- [ ] **Step 1: Write failing tests** for combined filters such as `MPI1-A + G2`, `Monday + M3`, teacher-only, room-only, and date-range filtering.
- [ ] **Step 2: Run** `node --test tests/web/v16-planning-state.test.cjs` and verify FAIL.
- [ ] **Step 3: Implement pure filter/summary functions** with no DOM dependency.
- [ ] **Step 4: Run** focused tests and verify PASS.
- [ ] **Step 5: Commit** with `git commit -m "feat(v16): add interactive planning filters"`.

### Task 4: Render the native interactive planning tab

**Files:**
- Create: `web/v16-planning-ui.js`
- Modify: `scripts/build_online_web.py`
- Modify: `scripts/build_single_file_release.py`
- Create: `tests/web/v16-planning-ui.test.cjs`

**Interfaces:**
- Consumes `V16PlanningData` and `V16PlanningState`.
- Produces `V16PlanningUI.init({supabaseClient,currentTeacher})` and `V16PlanningUI.refresh()`.

- [ ] **Step 1: Write failing DOM-contract tests** asserting the planning tab has filters for class/group/day/week/teacher/manipulation/room/period, counters, a responsive result table, loading state, and explicit empty/error messages.
- [ ] **Step 2: Run** `node --test tests/web/v16-planning-ui.test.cjs` and verify FAIL.
- [ ] **Step 3: Implement the UI** using native selects/date inputs and V5.13 visual classes. Filter changes must re-render the table immediately without page reload.
- [ ] **Step 4: Remove the old launcher behavior** from `web/v515-planning-ui.js` by excluding it from the V16 build or neutralizing `injectLauncher()` for V16.
- [ ] **Step 5: Update the build scripts** so the new V16 modules are bundled in dependency order.
- [ ] **Step 6: Run** `node --test tests/web/v16-planning-ui.test.cjs tests/web/build-web.test.cjs` and verify PASS.
- [ ] **Step 7: Commit** with `git commit -m "feat(v16): render native interactive planning tab"`.

### Task 5: Preserve V5.13 attendance/grade behavior

**Files:**
- Test: `tests/web/attendance-policy.test.cjs`
- Test: `tests/web/report-grade-only.test.cjs`
- Test: `tests/web/baseline.test.cjs`

- [ ] **Step 1: Run** `node --test tests/web/attendance-policy.test.cjs tests/web/report-grade-only.test.cjs tests/web/baseline.test.cjs`.
- [ ] **Step 2: If any regression fails, fix only the V16 integration boundary**, not the V5.13 business rule.
- [ ] **Step 3: Run** `python scripts/build_single_file_release.py` and verify a standalone HTML is produced successfully.
- [ ] **Step 4: Commit** any required regression fix separately with `git commit -m "fix(v16): preserve v5.13 attendance behavior"`.
