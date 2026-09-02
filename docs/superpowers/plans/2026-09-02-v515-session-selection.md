# V5.15 Session Selection and Fortnight Rotation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the verified V5 application with configurable 1-6 groups per class, deterministic M1-M6 fortnight rotation, teacher session requests, administrator validation/direct assignment, individual quotas, allowed manipulations, and safe finalization into the existing Presence/Notes workflow.

**Architecture:** Keep the existing V5 attendance/grade/authentication core unchanged and add an isolated V5.15 planning subsystem. Supabase/PostgreSQL is authoritative for rotation, quotas, permissions, assignments, lifecycle transitions, and finalization; the Web layer uses focused V5.15 API/UI modules and the existing online-only runtime. The synchronized Windows application continues to embed the generated Web artifact, so no duplicate Windows business logic is introduced.

**Tech Stack:** Supabase PostgreSQL/RLS/PLpgSQL, Supabase Auth and existing teacher profiles, Supabase JS, HTML/CSS/vanilla JavaScript, Node.js 22 `node:test`, Python 3.12 build scripts, GitHub Actions, .NET 8 WebView2 synchronized Windows host.

**Spec:** `docs/superpowers/specs/2026-09-02-v515-session-selection-design.md`

## Global Constraints

- Start from branch `feature/v5.15-session-selection`, based on the latest verified `main`; keep `release/v5.13` unchanged as rollback reference.
- Keep six manipulations exactly: `M1`, `M2`, `M3`, `M4`, `M5`, `M6`.
- Group count is configurable per class from 1 through 6; default is 4.
- Every group must complete all six manipulations exactly once per pedagogical cycle.
- Every group follows a fortnight schedule; Week A / Week B class pairing is administrator-configurable per recurring timeslot.
- Several teachers may request the same position; only one validated assignment may exist for a position.
- Requests are unlimited and do not consume quota; only validated assignments consume an individual teacher quota.
- An administrator may directly assign a teacher without a prior request, but the same server-side eligibility checks apply.
- A teacher cannot have two validated assignments with overlapping date/time intervals.
- Allowed manipulations are configured per teacher and enforced server-side.
- Finalized/realized historical sessions are never rewritten by regeneration or group-count changes.
- No `service_role` credential is exposed to browser/Windows clients.
- Existing authentication, attendance, grades, closing, history, PDF/Word export, print, and corrected presence/student behavior must remain operational.
- Generated `web/index.html` remains a build artifact; source changes belong in focused modules, migrations, build scripts, or the canonical base source where strictly necessary.

---

### Task 1: Add the V5.15 planning schema and lifecycle model

**Files:**
- Create: `supabase/migrations/20260902190000_v515_planning_schema.sql`
- Create: `supabase/tests/v515_schema.sql`
- Create: `tests/web/v515-sql-contract.test.cjs`

**Interfaces:**
- Produces tables: `v515_cycles`, `v515_class_config`, `v515_group_rosters`, `v515_timeslots`, `v515_fortnight_pairs`, `v515_rotation`, `v515_teacher_config`, `v515_teacher_manipulations`, `v515_session_positions`, `v515_requests`, `v515_assignments`, `v515_audit_log`.
- Adds nullable compatibility columns to `sessions`: `v515_position_id uuid`, `manipulation_code text`, `room text`.
- Later RPC tasks depend on the exact column names and status values defined here.

- [ ] **Step 1: Write the failing SQL contract test** in `tests/web/v515-sql-contract.test.cjs` so it requires the migration file and the exact V5.15 table names.

```js
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const p='supabase/migrations/20260902190000_v515_planning_schema.sql';

test('V5.15 schema contract exists',()=>{
  assert.equal(fs.existsSync(p),true);
  const sql=fs.readFileSync(p,'utf8');
  for(const name of [
    'v515_cycles','v515_class_config','v515_group_rosters','v515_timeslots',
    'v515_fortnight_pairs','v515_rotation','v515_teacher_config',
    'v515_teacher_manipulations','v515_session_positions','v515_requests',
    'v515_assignments','v515_audit_log'
  ]) assert.match(sql,new RegExp(`create\\s+table[^;]*${name}`,'i'),name);
  assert.match(sql,/group_count[^,;]*check[^,;]*between\s+1\s+and\s+6/i);
  assert.match(sql,/manipulation_code[^,;]*check[^,;]*M1/i);
});
```

- [ ] **Step 2: Run** `node --test tests/web/v515-sql-contract.test.cjs` and verify RED because the migration does not yet exist.
- [ ] **Step 3: Implement the schema** with `gen_random_uuid()` primary keys, foreign keys to existing `profiles`, `classes`, and `sessions`, timestamps, and explicit checks. Use these lifecycle values:
  - cycle: `DRAFT`, `OPEN_FOR_REQUESTS`, `ASSIGNMENT`, `FINALIZED`;
  - position: `DRAFT`, `OPEN`, `ASSIGNED`, `FINALIZED`, `REALIZED`, `CANCELLED`;
  - request: `PENDING`, `ACCEPTED`, `REJECTED`, `CANCELLED`.
- [ ] **Step 4: Define the internal roster bridge** `v515_group_rosters(class_config_id, group_no, legacy_class_id)` so each generated group position resolves to one existing student roster without duplicating students. Enforce `group_no between 1 and 6` and unique `(class_config_id, group_no)`.
- [ ] **Step 5: Add unique/index constraints** for `(cycle_id,class_key)`, `(position_id,teacher_id)` requests, one assignment per `position_id`, and lookup indexes on teacher/date/time/status.
- [ ] **Step 6: Add nullable legacy-session traceability**:

```sql
alter table public.sessions add column if not exists v515_position_id uuid;
alter table public.sessions add column if not exists manipulation_code text;
alter table public.sessions add column if not exists room text;
create unique index if not exists sessions_v515_position_uidx
  on public.sessions(v515_position_id) where v515_position_id is not null;
```

- [ ] **Step 7: Write `supabase/tests/v515_schema.sql`** with `begin;`/`rollback;` assertions for invalid group counts, invalid manipulation codes, duplicate assignments, and invalid lifecycle values.
- [ ] **Step 8: Run** the Node SQL-contract test and execute the SQL test against a disposable PostgreSQL/Supabase test database; require all assertions to pass.
- [ ] **Step 9: Commit** with message `feat(db): add V5.15 planning schema`.

### Task 2: Implement deterministic rotation, fortnight generation, reset, cancellation, and catch-up

**Files:**
- Create: `supabase/migrations/20260902191000_v515_rotation_rpcs.sql`
- Create: `supabase/tests/v515_rotation.sql`
- Create: `tests/web/v515-rotation-contract.test.cjs`

**Interfaces:**
- Produces RPCs:
  - `v515_generate_cycle(p_cycle_id uuid) -> jsonb`
  - `v515_reset_cycle(p_cycle_id uuid) -> jsonb`
  - `v515_cancel_position(p_position_id uuid) -> jsonb`
  - `v515_create_catchup(p_position_id uuid, p_date date, p_start time, p_end time, p_room text) -> jsonb`
  - `v515_set_rotation_exception(p_position_id uuid, p_manipulation_code text) -> jsonb`
- Rotation formula is exactly `((group_no + pedagogical_session_no - 2) % 6) + 1`.

- [ ] **Step 1: Write failing contract tests** requiring the RPC names and formula marker.

```js
const sql=fs.readFileSync('supabase/migrations/20260902191000_v515_rotation_rpcs.sql','utf8');
assert.match(sql,/v515_generate_cycle/i);
assert.match(sql,/group_no\s*\+\s*pedagogical_session_no\s*-\s*2/i);
assert.match(sql,/mod\s*\([^)]*,\s*6\s*\)|%\s*6/i);
```

- [ ] **Step 2: Run** the contract test and verify RED.
- [ ] **Step 3: Implement `v515_generate_cycle`** as an admin-only transaction. Lock the cycle row, require `DRAFT`, clear only draft V5.15 positions/rotation rows for the cycle, generate recurring dates between `start_date` and `end_date`, alternate Week A/B from `week_a_anchor_date`, rank each class's actual occurrences as pedagogical sessions 1-6, and create one position per active group using the exact M1-M6 formula.
- [ ] **Step 4: Limit a class cycle to its first six pedagogical occurrences** and fail generation if six valid fortnight occurrences cannot be produced inside the cycle dates.
- [ ] **Step 5: Validate roster completeness before opening**: every active group `G1..G(group_count)` must have one `v515_group_rosters` mapping.
- [ ] **Step 6: Implement reset rules**: `OPEN_FOR_REQUESTS` or `ASSIGNMENT` may return to `DRAFT` only when no position is `FINALIZED` or `REALIZED`; reset cancels pending requests, removes only non-final assignments/positions, and writes audit rows.
- [ ] **Step 7: Implement cancellation/catch-up** so cancellation does not increment pedagogical session number and the catch-up copies the source class, group, pedagogical-session number, manipulation, and roster mapping while allowing a new date/time/room.
- [ ] **Step 8: Implement controlled rotation exception** and reject duplicate simultaneous manipulations, repeats already realized by the same group, or any change that makes the six-manipulation set incomplete.
- [ ] **Step 9: Write SQL tests** for group counts 1,2,3,4,5,6; each group must receive exactly six distinct codes and the four-group case must equal:

```text
S1: G1-M1 G2-M2 G3-M3 G4-M4
S2: G1-M2 G2-M3 G3-M4 G4-M5
S3: G1-M3 G2-M4 G3-M5 G4-M6
S4: G1-M4 G2-M5 G3-M6 G4-M1
S5: G1-M5 G2-M6 G3-M1 G4-M2
S6: G1-M6 G2-M1 G3-M2 G4-M3
```

- [ ] **Step 10: Test A/B pairing, cancellation, catch-up, pre-open group-count regeneration, reset, and post-finalization rejection**.
- [ ] **Step 11: Run** contract + SQL tests and require GREEN.
- [ ] **Step 12: Commit** with message `feat(db): add V5.15 fortnight rotation engine`.

### Task 3: Implement teacher configuration, requests, quotas, validation, direct assignment, and audit

**Files:**
- Create: `supabase/migrations/20260902192000_v515_assignment_rpcs.sql`
- Create: `supabase/tests/v515_assignment.sql`
- Create: `tests/web/v515-assignment-contract.test.cjs`

**Interfaces:**
- Produces RPCs:
  - `v515_set_teacher_config(p_teacher_id uuid, p_quota integer, p_active boolean, p_manipulations text[]) -> jsonb`
  - `v515_submit_request(p_position_id uuid) -> jsonb`
  - `v515_cancel_request(p_request_id uuid) -> jsonb`
  - `v515_accept_request(p_request_id uuid) -> jsonb`
  - `v515_reject_request(p_request_id uuid) -> jsonb`
  - `v515_direct_assign(p_position_id uuid, p_teacher_id uuid) -> jsonb`
- Produces internal helper `v515_assert_assignment_allowed(p_position_id uuid, p_teacher_id uuid) -> void`.

- [ ] **Step 1: Write failing tests** requiring all RPC names and domain error codes `QUOTA_REACHED`, `MANIPULATION_NOT_ALLOWED`, `TEACHER_OVERLAP`, `POSITION_ALREADY_ASSIGNED`, `TEACHER_INACTIVE`.
- [ ] **Step 2: Run** the contract test and verify RED.
- [ ] **Step 3: Implement teacher config RPC** using existing `profiles.id`; do not create a second authentication store. Replace the teacher's allowed-manipulation set transactionally and audit old/new quota and manipulation values.
- [ ] **Step 4: Implement unlimited request submission**: require authenticated active teacher, open position, allowed manipulation, and no duplicate active request. Do **not** reject because the teacher has already submitted another request at the same time and do **not** decrement quota.
- [ ] **Step 5: Implement request cancellation** only for the current teacher and only while `PENDING`.
- [ ] **Step 6: Implement the shared assignment guard**. Lock the position and teacher configuration rows and verify:

```sql
remaining_quota = quota - count(*) from v515_assignments where teacher_id = p_teacher_id;
```

Then reject when quota is exhausted, manipulation is not allowed, teacher is inactive, the position already has an assignment, or another validated assignment overlaps the same date/time interval.
- [ ] **Step 7: Implement `v515_accept_request`** as one atomic transaction: guard -> create assignment -> mark selected request `ACCEPTED` -> mark all other `PENDING` requests for the same position `REJECTED` -> set position `ASSIGNED` -> write audit.
- [ ] **Step 8: Implement `v515_direct_assign`** through the same guard without requiring a request.
- [ ] **Step 9: Implement explicit admin rejection** without affecting other pending candidates.
- [ ] **Step 10: Write SQL concurrency/business tests** covering unlimited requests, competing candidates, quota 0/1/N, overlapping assignments, exact boundary `end_time = next start_time` as non-overlap, inactive teacher, and unauthorized manipulation.
- [ ] **Step 11: Run** all dedicated tests and require GREEN.
- [ ] **Step 12: Commit** with message `feat(db): add V5.15 teacher request and assignment rules`.

### Task 4: Add authoritative read models and RLS

**Files:**
- Create: `supabase/migrations/20260902193000_v515_rls_and_views.sql`
- Create: `supabase/tests/v515_rls.sql`
- Test: `tests/web/v515-security-contract.test.cjs`

**Interfaces:**
- Produces RPCs/read models:
  - `v515_my_dashboard() -> jsonb`
  - `v515_available_positions() -> setof record`
  - `v515_my_requests() -> setof record`
  - `v515_my_assignments() -> setof record`
  - `v515_admin_snapshot(p_cycle_id uuid) -> jsonb`
  - `v515_visible_students() -> setof record` for students belonging to finalized V5.15 sessions assigned to the current teacher.
- All mutation RPCs are `security definer`, set `search_path = public, pg_temp`, explicitly check `auth.uid()`, and revoke `PUBLIC`/`anon` execute.

- [ ] **Step 1: Write failing security contract tests** requiring `enable row level security`, explicit grants, `security definer`, and `set search_path` in V5.15 migrations.
- [ ] **Step 2: Run** the contract test and verify RED.
- [ ] **Step 3: Add RLS** so teachers can read only their own request/assignment rows and cannot directly mutate administrator-owned configuration. Administrators retain configuration visibility through explicit policies/RPCs.
- [ ] **Step 4: Implement `v515_available_positions()`** to return only unassigned/open positions matching the current teacher's allowed manipulations and active teacher configuration. Include `my_request_status` so the UI can show `Demandée`/`Annulée` without another N+1 query.
- [ ] **Step 5: Implement dashboard counts**: `quota_total`, `validated_count`, `pending_count`, `remaining_quota`, `allowed_manipulations`, `upcoming_assignments`.
- [ ] **Step 6: Implement `v515_admin_snapshot`** returning cycle state, class configs, group counts, timeslots, A/B pairs, teacher config, pending candidate counts, uncovered positions, assignments, and verification summary in one server-authorized response.
- [ ] **Step 7: Implement `v515_visible_students()`** to expose only students linked to canonical group rosters used by the authenticated teacher's finalized V5.15 sessions; never expose unrelated rosters.
- [ ] **Step 8: Write RLS tests** using two teacher identities and one admin identity. Prove teacher A cannot read/update teacher B requests, cannot invoke admin mutations, and cannot read unrelated students.
- [ ] **Step 9: Run** dedicated tests and require GREEN.
- [ ] **Step 10: Commit** with message `security(db): enforce V5.15 RLS and read models`.

### Task 5: Verify planning and finalize safely into the existing Presence/Notes model

**Files:**
- Create: `supabase/migrations/20260902194000_v515_finalize.sql`
- Create: `supabase/tests/v515_finalize.sql`
- Modify: `web/access-control.js`
- Modify: `web/session-editing.js` only if current session rendering/editing must prefer session-level `room`/`manipulation_code`.
- Test: `tests/web/v515-finalization-integration.test.cjs`

**Interfaces:**
- Produces RPCs:
  - `v515_verify_cycle(p_cycle_id uuid) -> jsonb`
  - `v515_finalize_cycle(p_cycle_id uuid) -> jsonb`
  - `v515_mark_realized(p_position_id uuid) -> jsonb`
- Finalized operational session contract: `sessions.teacher_id = validated teacher`, `sessions.class_id = v515_group_rosters.legacy_class_id`, `sessions.v515_position_id = position id`, `sessions.manipulation_code = M1..M6`, `sessions.room = position room`.

- [ ] **Step 1: Write failing SQL tests** for every blocking verification category: missing assignment, incomplete M1-M6 cycle, duplicate simultaneous manipulation, exceeded quota, manipulation mismatch, teacher overlap, missing roster mapping, changed finalized/realized position.
- [ ] **Step 2: Implement `v515_verify_cycle`** returning a stable JSON shape:

```json
{"ok":false,"errors":[{"code":"UNCOVERED_POSITION","position_id":"..."}],"counts":{"positions":24,"assigned":23,"uncovered":1}}
```

- [ ] **Step 3: Implement `v515_finalize_cycle`**. Lock the cycle, call verification, abort if `ok=false`, then insert missing operational `sessions` rows using the roster mapping and validated teacher. Use `v515_position_id` uniqueness for idempotence. Do not modify any pre-existing non-V5.15 session.
- [ ] **Step 4: Set position/cycle state to `FINALIZED` only after every operational session insert succeeds** and record one audit event containing cycle id, actor, counts, and timestamp.
- [ ] **Step 5: Implement `v515_mark_realized`** so the position becomes immutable after the operational session is actually completed.
- [ ] **Step 6: Merge V5.15 visible roster students into Web authoritative state** in `web/access-control.js` for teachers with finalized V5.15 sessions. Deduplicate by student id and leave existing owner/admin behavior unchanged.
- [ ] **Step 7: Map new session metadata** so rendering can prefer `session.room` over legacy `class.room` and show `manipulation_code` when present, while old sessions keep their previous display.
- [ ] **Step 8: Write Web regression test** proving a teacher assigned to a V5.15 roster receives those students in the presence dataset and old sessions without V5.15 fields still map normally.
- [ ] **Step 9: Run** V5.15 finalization tests plus existing attendance/grade tests.
- [ ] **Step 10: Commit** with message `feat: finalize V5.15 planning into presence sessions`.

### Task 6: Add a focused Web API client for V5.15

**Files:**
- Create: `web/v515-api.js`
- Modify: `scripts/build_online_web.py`
- Modify: `scripts/build_single_file_release.py`
- Test: `tests/web/v515-api.test.cjs`

**Interfaces:**
- Produces `window.FSTV515Api` with methods:
  - `dashboard()`
  - `availablePositions()`
  - `myRequests()`
  - `myAssignments()`
  - `adminSnapshot(cycleId)`
  - `submitRequest(positionId)`
  - `cancelRequest(requestId)`
  - `acceptRequest(requestId)`
  - `rejectRequest(requestId)`
  - `directAssign(positionId, teacherId)`
  - `generateCycle(cycleId)`
  - `resetCycle(cycleId)`
  - `verifyCycle(cycleId)`
  - `finalizeCycle(cycleId)`

- [ ] **Step 1: Write failing Node tests** that load the module in a VM with a mocked `supabaseClient.rpc` and assert each method uses the exact RPC name and parameter names.
- [ ] **Step 2: Run** `node --test tests/web/v515-api.test.cjs` and verify RED.
- [ ] **Step 3: Implement a small IIFE** with one shared `rpc(name,args)` wrapper. Convert Supabase/raw errors to domain messages without swallowing error codes.
- [ ] **Step 4: Do not place business-rule decisions in this module**; it is a typed-by-convention transport adapter only.
- [ ] **Step 5: Add `./v515-api.js` to `build_online_web.py` tags** and inline it in `build_single_file_release.py` before V5.15 UI modules.
- [ ] **Step 6: Add final-build marker** `window.FSTV515Api=` and assert it is present in the standalone HTML.
- [ ] **Step 7: Run** dedicated/full Web tests and both build scripts.
- [ ] **Step 8: Commit** with message `feat(web): add V5.15 Supabase API client`.

### Task 7: Build the teacher session-choice UI

**Files:**
- Create: `web/v515-teacher-ui.js`
- Modify: `scripts/build_single_file_release.py`
- Test: `tests/web/v515-teacher-ui.test.cjs`

**Interfaces:**
- Produces `window.FSTV515TeacherUI.install()`, `.refresh()`, `.destroy()`.
- Consumes `window.FSTV515Api`, `currentTeacher`, existing `showAlert`, existing `.nav-tabs` and `.content` containers.

- [ ] **Step 1: Write failing source/DOM-contract tests** requiring a `Choix des séances` tab, dashboard counters, filters for class/date/manipulation/week/status, and actions `Demander` / `Annuler`.
- [ ] **Step 2: Run** the test and verify RED.
- [ ] **Step 3: Implement dynamic tab installation** without rewriting the canonical large HTML. Add one nav button and one `tab-content` container with deterministic ids such as `v515-tab-button` and `v515-planning`.
- [ ] **Step 4: Render teacher dashboard** with quota total, validated, pending, remaining, allowed manipulations, and upcoming validated sessions.
- [ ] **Step 5: Render available positions** as rows/cards containing `Classe | Date | Horaire | Groupe | Manipulation | Salle | Action`. The list comes only from `v515_available_positions()`; do not re-implement eligibility in JavaScript.
- [ ] **Step 6: Implement filters client-side** over the already-authorized returned list.
- [ ] **Step 7: Implement request/cancel actions** through `FSTV515Api`, disable the clicked button while the RPC is pending, refresh authoritative V5.15 state after success, and show domain-specific messages on failure.
- [ ] **Step 8: Render accepted/rejected/cancelled/pending states** with existing badge style conventions and accessible text labels.
- [ ] **Step 9: Run** dedicated/full Web tests and standalone build.
- [ ] **Step 10: Commit** with message `feat(web): add V5.15 teacher session selection`.

### Task 8: Build the administrator V5.15 planning console

**Files:**
- Create: `web/v515-admin-ui.js`
- Modify: `scripts/build_single_file_release.py`
- Test: `tests/web/v515-admin-ui.test.cjs`

**Interfaces:**
- Produces `window.FSTV515AdminUI.install()`, `.refresh(cycleId)`, `.destroy()`.
- Consumes `FSTV515Api.adminSnapshot`, existing teacher-account creation flow, and V5.15 admin RPCs.

- [ ] **Step 1: Write failing UI contract tests** requiring sections for: class/group configuration, roster mapping, timeslots/A-B pairing, rotation preview, teacher quota/manipulations, request candidates, direct assignment, uncovered positions, verification, finalization.
- [ ] **Step 2: Run** tests and verify RED.
- [ ] **Step 3: Render class configuration** with group count selector 1-6 defaulting to 4 and roster mapping rows for each active group.
- [ ] **Step 4: Render recurring timeslot configuration** with weekday, start/end, room, Week A class, Week B class; also expose an exceptional/catch-up date/time/room action.
- [ ] **Step 5: Add `Générer le planning`** which calls `v515_generate_cycle`, then renders the returned/generated preview before the cycle is opened.
- [ ] **Step 6: Render teacher configuration** from existing teacher identities: quota, active status, checkboxes M1-M6, validated count, pending count, remaining quota. Adding a teacher must call the existing account-creation flow first, then attach V5.15 config.
- [ ] **Step 7: Build candidate review** grouped by session position. For each candidate show teacher name, quota remaining, and allowed manipulation; `Valider` calls `acceptRequest`, `Refuser` calls `rejectRequest`.
- [ ] **Step 8: Build direct assignment** from an administrator-filtered list returned by the authoritative snapshot/RPC; the final server guard remains authoritative.
- [ ] **Step 9: Add `Vérifier le planning`** and render every returned blocking issue with its code, class/group/date/manipulation context.
- [ ] **Step 10: Add `Finaliser`** disabled unless the latest verification result is `ok=true`. Finalization still re-verifies server-side to prevent stale-client races.
- [ ] **Step 11: Add reset confirmation** only when server reports reset is allowed; clearly state that pending requests and non-final assignments will be cancelled.
- [ ] **Step 12: Run** dedicated/full Web tests and standalone build.
- [ ] **Step 13: Commit** with message `feat(web): add V5.15 administrator planning console`.

### Task 9: Integrate authentication lifecycle and V5.15 realtime refresh without destabilizing V5

**Files:**
- Create: `web/v515-runtime.js`
- Modify: `web/online-runtime.js`
- Modify: `scripts/build_single_file_release.py`
- Test: `tests/web/v515-runtime.test.cjs`

**Interfaces:**
- Produces `window.FSTV515` with `onAuthenticated()`, `refresh()`, `startRealtime()`, `stopRealtime()`, `onLogout()`.
- Uses one V5.15 realtime channel for `v515_requests`, `v515_assignments`, `v515_session_positions`, `v515_teacher_config`, `v515_teacher_manipulations`.

- [ ] **Step 1: Write failing tests** requiring V5.15 initialization after successful login, channel cleanup on logout/account switch, and no local/offline persistence.
- [ ] **Step 2: Run** tests and verify RED.
- [ ] **Step 3: Implement V5.15 runtime** so authenticated teacher mode installs/refreshes teacher UI, admin mode installs both teacher-visible status and admin console, and unauthenticated state destroys V5.15 UI.
- [ ] **Step 4: Subscribe to V5.15 Postgres changes** and debounce refresh; do not reload the page.
- [ ] **Step 5: Add minimal hooks to `web/online-runtime.js`** after successful `doLogin` and before logout/switch-account cleanup:

```js
await window.FSTV515?.onAuthenticated?.();
window.FSTV515?.onLogout?.();
```

- [ ] **Step 6: Keep existing `FSTOnlineRuntime.TABLES` and stable attendance realtime behavior unchanged**; V5.15 uses its own channel.
- [ ] **Step 7: Inline V5.15 runtime after API/UI modules** and assert `window.FSTV515=` exists in final HTML.
- [ ] **Step 8: Run** syntax checks, dedicated tests, all existing Web tests, and both build scripts.
- [ ] **Step 9: Commit** with message `feat(web): integrate V5.15 authenticated realtime runtime`.

### Task 10: Version, CI, synchronized Windows artifact, and full regression gate

**Files:**
- Modify: `.github/workflows/build-web.yml`
- Modify: `.github/workflows/build-windows-online.yml`
- Create: `.github/workflows/test-v515-database.yml`
- Modify: `windows/GestionPresenceFSTOnline/GestionPresenceFSTOnline.csproj`
- Test: existing `tests/web/*.test.cjs`
- Test: `supabase/tests/v515_*.sql`

**Interfaces:**
- Produces Web artifact `Gestion-Presence-FST-Web-v5.15.0.html` and synchronized Windows artifact `Gestion-Presence-FST-Windows-v5.15.0.exe`/`.zip`.
- Database CI requires a disposable PostgreSQL 17 service and never targets the production Supabase database.

- [ ] **Step 1: Add PostgreSQL 17 CI service** in `test-v515-database.yml`. Create the minimal `auth`/legacy table bootstrap needed by the migrations, apply V5.15 migrations in timestamp order, then run every `supabase/tests/v515_*.sql` with `psql -v ON_ERROR_STOP=1`.
- [ ] **Step 2: Extend Web CI syntax checks** to `node --check web/v515-api.js web/v515-teacher-ui.js web/v515-admin-ui.js web/v515-runtime.js` and keep the existing full `tests/web/*.test.cjs` loop.
- [ ] **Step 3: Add final artifact assertions** for `FSTV515Api`, `FSTV515TeacherUI`, `FSTV515AdminUI`, `FSTV515`, `v515_submit_request`, and `v515_finalize_cycle` markers.
- [ ] **Step 4: Update Web artifact naming** to V5.15.0 without changing the canonical rollback/reference HTML.
- [ ] **Step 5: Update synchronized Windows project version**:

```xml
<Version>5.15.0</Version>
<FileVersion>5.15.0.0</FileVersion>
<AssemblyVersion>5.15.0.0</AssemblyVersion>
```

The existing `EmbeddedResource Include="..\..\web\index.html"` remains the single synchronized business-logic source.
- [ ] **Step 6: Update Windows workflow artifact names** to `Gestion-Presence-FST-Windows-v5.15.0` and require the embedded HTML to contain V5.15 markers.
- [ ] **Step 7: Run the full local/CI verification sequence**:

```bash
node --check web/security-v2.js
node --check web/v515-api.js
node --check web/v515-teacher-ui.js
node --check web/v515-admin-ui.js
node --check web/v515-runtime.js
node --test tests/web/*.test.cjs
python scripts/build_online_web.py
python scripts/build_single_file_release.py
```

Then run database tests and the Windows build workflow.
- [ ] **Step 8: Explicitly re-run non-regression checks** for login/MFA/PIN, teacher/admin role separation, attendance before/after closure rules, grade editing after closure, student visibility, history, PDF, Word, print, and existing historical sessions.
- [ ] **Step 9: Verify V5.15 acceptance scenario end-to-end**: create a four-group class cycle, generate six fortnight occurrences, confirm exact M1-M6 rotation, submit competing teacher requests, validate one candidate, hit quota/overlap/manipulation guards, direct-assign an uncovered position, verify cycle, finalize, open the generated operational session in Presence/Notes, and confirm the correct roster is visible.
- [ ] **Step 10: Compute SHA-256 hashes** for final Web and Windows artifacts and retain `release/v5.13` untouched.
- [ ] **Step 11: Commit** final integration/version changes with message `release: prepare V5.15 planning and session selection`.

## Execution Order and Review Gates

Tasks 1-5 establish the authoritative Supabase contract and must be reviewed before UI work is accepted. Tasks 6-9 consume those exact RPC names and response shapes; do not rename interfaces without updating both plan and dependent tests. Task 10 is a release gate only after all prior task tests are GREEN.

The official native Android application under `app-native/` is a separate native codebase. This plan deliberately stabilizes the shared Supabase V5.15 contract and the Web/Windows synchronized implementation first; native Android V5.15 parity should use this same RPC contract in a dedicated follow-up implementation plan rather than duplicating unfinished backend behavior in parallel.
