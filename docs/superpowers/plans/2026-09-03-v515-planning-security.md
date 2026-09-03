# V5.15 Planning, Security and Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the V5.15 planning engine, server-side assignment security, 2026/2027 planning import, validation workflow, and non-regression protection while keeping V5.13 immutable.

**Architecture:** V5.15 is an additive layer. Pure planning/rotation logic is implemented and tested independently in Web JavaScript, persistence and critical invariants are implemented in new `v515_*` PostgreSQL objects, and the existing standalone Web build consumes the new module without changing V5.13 attendance/grade semantics. The supplied 2026/2027 Excel planning is normalized into deterministic seed data; room mappings are excluded because the files contain contradictory room notes.

**Tech Stack:** HTML/CSS/JavaScript, Node.js `node:test`, Supabase/PostgreSQL SQL migrations, existing standalone build scripts.

**Spec:** `docs/superpowers/specs/2026-09-03-v515-planning-security-design.md`

## Global Constraints

- Never modify or force-push `release/v5.13`.
- Preserve the canonical V5.13 attendance and grade behavior.
- V5.15 database objects use the `v515_*` prefix.
- No `service_role` key in Web, Windows, or Android clients.
- All new exposed tables have RLS.
- Completed historical sessions cannot be rewritten by V5.15 planning actions.
- A holiday/rest/no-TP calendar row never consumes a pedagogical rotation step.
- Planning publication may warn on an incomplete M1-M6 cycle; pedagogical cycle closure must block until M1-M6 is complete or explicitly waived by Admin.
- Do not import room assignments from the current workbooks because their room notes are internally inconsistent.

---

### Task 1: Lock V5.13 non-regression contracts

**Files:**
- Create: `tests/web/v515-v513-regression.test.cjs`
- Read: `releases/v5.13/REFERENCE.md`
- Read: `web/session-permissions.js`
- Read: `web/session-editing.js`

**Interfaces:**
- Produces: regression assertions used as release gates for all subsequent tasks.

- [ ] **Step 1: Write a test that verifies the V5.13 reference metadata remains canonical**

```js
const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');

test('v5.13 stable reference remains canonical', () => {
  const ref = fs.readFileSync('releases/v5.13/REFERENCE.md', 'utf8');
  assert.match(ref, /Version: V5\.13/);
  assert.match(ref, /73daccbc12f1e9d0068a53a5d3f7052f3002a49963ce3842f3fa6040650538e8/);
  assert.match(ref, /Do not overwrite the V5\.13 reference/);
});
```

- [ ] **Step 2: Add permission contract assertions** requiring teacher attendance before closure only, Admin attendance before/after closure, and grade edit before/after closure for owner/Admin.
- [ ] **Step 3: Add a source contract assertion** that `session-editing.js` contains an explicit empty-group warning rather than rendering an empty screen.
- [ ] **Step 4: Run** `node --test tests/web/v515-v513-regression.test.cjs` and verify PASS against the baseline.
- [ ] **Step 5: Commit** `test: lock v5.13 behavior before v5.15`.

### Task 2: Implement a pure V5.15 rotation engine

**Files:**
- Create: `web/v515-planning-core.js`
- Create: `tests/web/v515-planning-core.test.cjs`

**Interfaces:**
- Produces: `V515Planning.manipulationFor(groupIndex, effectiveSessionIndex, manipulationCount=6) -> string`
- Produces: `V515Planning.nextPairClass(pair, effectiveSessionIndex) -> string`
- Produces: `V515Planning.buildEffectiveSessions(calendarRows, pair) -> session[]`
- Produces: `V515Planning.completeness(sessions, className, groupCount, manipulationCount=6) -> object`

- [ ] **Step 1: Write failing rotation tests** for group counts 1-6 and manipulation cycle M1-M6.
- [ ] **Step 2: Write failing tests for the supplied Monday pair**: 14/09 MPI1-A, 21/09 MPI1-E, 28/09 MPI1-A, with 02/11 marked no-TP and therefore not consuming an alternation/rotation step.
- [ ] **Step 3: Write failing tests for Thursday** verifying 15/10 and 05/11 do not consume a step.
- [ ] **Step 4: Write failing tests for Friday** verifying 06/11 does not consume a step.
- [ ] **Step 5: Implement modulo-based rotation** so four-group sequence is `M1 M2 M3 M4`, then `M2 M3 M4 M5`, etc.
- [ ] **Step 6: Implement effective-session filtering** using an explicit `isTeachingSession` flag rather than date arithmetic.
- [ ] **Step 7: Run** `node --test tests/web/v515-planning-core.test.cjs` and verify PASS.
- [ ] **Step 8: Commit** `feat: add v5.15 pedagogical rotation engine`.

### Task 3: Add deterministic 2026/2027 planning seed data

**Files:**
- Create: `web/v515-planning-2026-2027.js`
- Create: `tests/web/v515-planning-2026-2027.test.cjs`

**Interfaces:**
- Consumes: `V515Planning` from Task 2.
- Produces: `V515PlanningData.calendarRows` with normalized ISO dates, weekday slot, class pair, class/no-TP status and expected group manipulations.

- [ ] **Step 1: Encode Monday rows exactly** from 2026-09-14 through 2026-11-30, including 2026-11-02 as `REPOS`.
- [ ] **Step 2: Encode Thursday rows exactly** from 2026-09-17 through 2026-12-03, including 2026-10-15 as holiday and 2026-11-05 as `REPOS`.
- [ ] **Step 3: Encode Friday rows exactly** from 2026-09-18 through 2026-12-04, including 2026-11-06 as `REPOS`.
- [ ] **Step 4: Add tests** asserting MPI1-A and MPI1-B reach 6/6, while MPI1-E, MPI1-C, MPI1-D and PC1-A remain 5/6 with missing sequence G1=M6, G2=M1, G3=M2, G4=M3.
- [ ] **Step 5: Add a test** asserting the seed contains no automatic room assignment.
- [ ] **Step 6: Run** `node --test tests/web/v515-planning-2026-2027.test.cjs` and verify PASS.
- [ ] **Step 7: Commit** `feat: add verified 2026-2027 v5.15 planning seed`.

### Task 4: Add additive V5.15 PostgreSQL schema and RLS

**Files:**
- Create: `supabase/migrations/20260903_v515_planning_core.sql`
- Create: `tests/web/v515-sql-security.test.cjs`

**Interfaces:**
- Produces tables: `v515_cycles`, `v515_class_pairs`, `v515_groups`, `v515_manipulations`, `v515_sessions`, `v515_teacher_constraints`, `v515_requests`, `v515_assignments`, `v515_waivers`, `v515_audit_log`.

- [ ] **Step 1: Write SQL contract tests** requiring all table names to be `v515_*`, RLS enabled, ownership/admin predicates present for teacher-facing data, and no `service_role` literal.
- [ ] **Step 2: Create lifecycle constraints** limiting cycle status to `draft`, `published`, `assignments_finalized`, `cycle_closed`.
- [ ] **Step 3: Create uniqueness constraints** preventing duplicate session/group/manipulation posts and duplicate active teacher assignments to the same mandatory post.
- [ ] **Step 4: Add foreign keys and immutable historical linkage fields** without altering legacy V5.13 tables.
- [ ] **Step 5: Enable RLS on every new exposed table** and create least-privilege policies for authenticated teachers/Admin.
- [ ] **Step 6: Restrict audit-log writes** to server-side RPC paths/Admin while allowing only authorized reads.
- [ ] **Step 7: Run SQL contract tests** and existing Web tests.
- [ ] **Step 8: Commit** `feat: add v5.15 additive planning schema`.

### Task 5: Add transactional request and assignment RPCs

**Files:**
- Create: `supabase/migrations/20260903_v515_planning_rpcs.sql`
- Create: `tests/web/v515-rpc-contract.test.cjs`

**Interfaces:**
- Produces RPCs: `v515_request_assignment(session_id, manipulation_code)`, `v515_cancel_request(request_id)`, `v515_validate_request(request_id)`, `v515_assign_teacher(session_id, group_no, manipulation_code, teacher_id)`, `v515_finalize_assignments(cycle_id)`.

- [ ] **Step 1: Write failing source-contract tests** requiring explicit `auth.uid()` identity checks, quota checks, allowed-manipulation checks, conflict checks and lifecycle checks.
- [ ] **Step 2: Implement teacher request RPC** so a teacher can only create a request for self.
- [ ] **Step 3: Implement cancellation RPC** so a teacher can cancel only own pending request, while Admin can perform privileged cancellation.
- [ ] **Step 4: Implement validation/direct-assignment RPCs** with transaction-scoped conflict checks and deterministic French business errors.
- [ ] **Step 5: Implement finalization RPC** that blocks when mandatory posts remain vacant or assignment rules are violated.
- [ ] **Step 6: Revoke broad EXECUTE privileges** on privileged RPCs and grant only required roles.
- [ ] **Step 7: Run contract tests** and database verification if a connected test database is available.
- [ ] **Step 8: Commit** `feat: enforce v5.15 assignment rules in postgres`.

### Task 6: Add global planning verification and closure rules

**Files:**
- Create: `web/v515-planning-validation.js`
- Create: `tests/web/v515-planning-validation.test.cjs`
- Extend: `supabase/migrations/20260903_v515_planning_rpcs.sql`

**Interfaces:**
- Produces: `V515PlanningValidation.verify(plan) -> {blockers,warnings}`.
- Produces RPC: `v515_close_cycle(cycle_id, waiver_ids default null)`.

- [ ] **Step 1: Test publication blockers** for invalid slot, duplicate group/session, inconsistent rotation and completed-session rewrite.
- [ ] **Step 2: Test publication warnings** for 5/6 completion and vacant teacher posts.
- [ ] **Step 3: Test finalization blockers** for quota, manipulation permission, time conflict, double assignment and vacancy.
- [ ] **Step 4: Test cycle closure** so incomplete 5/6 classes fail unless an explicit Admin waiver covers the missing requirement.
- [ ] **Step 5: Implement pure validation module** returning stable machine codes plus French display messages.
- [ ] **Step 6: Implement server-side cycle-close RPC** with the same blocking invariants.
- [ ] **Step 7: Run dedicated/full tests**.
- [ ] **Step 8: Commit** `feat: add v5.15 planning verification gates`.

### Task 7: Add V5.15 Web integration without changing attendance/grade semantics

**Files:**
- Create: `web/v515-planning-ui.js`
- Modify: `scripts/build_single_file_release.py`
- Create: `tests/web/v515-planning-ui.test.cjs`

**Interfaces:**
- Consumes: `V515Planning`, `V515PlanningData`, `V515PlanningValidation`, Supabase RPC client.
- Produces: Admin planning view, Teacher compatible-session/request view, `Vérifier le planning` action and lifecycle status display.

- [ ] **Step 1: Write build/order tests** requiring V5.15 core/data/validation/UI modules to be inlined after baseline security/session modules.
- [ ] **Step 2: Add Teacher UI** limited to compatible session view, own request create/cancel, own assignments/quota.
- [ ] **Step 3: Add Admin UI** for group count, pair slots, quotas, manipulation permissions, request validation and direct assignment.
- [ ] **Step 4: Add verification UI** separating blockers from warnings and disabling only the lifecycle action corresponding to blockers.
- [ ] **Step 5: Ensure attendance/grade functions remain delegated to existing V5.13 modules** rather than duplicated in V5.15.
- [ ] **Step 6: Build the standalone HTML** and run Web tests.
- [ ] **Step 7: Commit** `feat: integrate v5.15 planning into standalone web app`.

### Task 8: Security, migration and release verification

**Files:**
- Create: `tests/web/v515-security-release.test.cjs`
- Create: `docs/v5.15-migration.md`

**Interfaces:**
- Produces: final release gate and migration procedure.

- [ ] **Step 1: Test repository/client sources** for absence of `service_role` secrets.
- [ ] **Step 2: Test that all V5.15 SQL tables enable RLS** and privileged RPCs restrict EXECUTE.
- [ ] **Step 3: Run the complete Web test suite** with `node --test tests/web/*.test.cjs`.
- [ ] **Step 4: Build the standalone Web artifact** using the existing build command documented by `tests/web/build-web.test.cjs` / repository scripts.
- [ ] **Step 5: Verify the V5.13 reference file and SHA metadata are unchanged** from Task 1.
- [ ] **Step 6: Document additive migration, rollback and activation order**: V5.13 backup -> V5.15 schema/RPC -> seed/configuration -> tests -> UI enablement.
- [ ] **Step 7: Commit** `docs: finalize v5.15 migration and release gates`.

## Self-review

- Spec coverage: baseline immutability, 1-6 groups, M1-M6 rotation, A/B class alternation, no-TP dates, incomplete-cycle warnings, finalization blockers, closure blockers, requests, direct assignments, quotas, allowed manipulations, RLS, audit logging, attendance/grade non-regression and additive migration are each mapped to tasks.
- No unresolved room assignment is implemented because the source workbooks contain contradictory room notes.
- No task requires rewriting completed V5.13 sessions.
- Function/module names are consistent across tasks.
