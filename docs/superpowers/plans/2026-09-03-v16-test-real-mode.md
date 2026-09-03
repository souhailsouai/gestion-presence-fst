# V16 Permanent Admin TEST/RÉEL Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a permanent Admin-only TEST environment that can simulate sessions and teacher configurations without contaminating RÉEL data, and selectively apply validated future teacher structures to RÉEL.

**Architecture:** Separate TEST from RÉEL at the data layer using explicit context-scoped tables/RPCs rather than client-only flags. Keep all teacher-facing reads bound to RÉEL. Applying TEST→RÉEL is a dedicated transaction that transfers only future teacher assignment structure after policy validation.

**Tech Stack:** PostgreSQL/Supabase RPC/RLS, vanilla JavaScript, Node.js tests.

**Spec:** `docs/superpowers/specs/2026-09-03-v16-planning-design.md`

## Global Constraints

- TEST is visible and writable only with active role Admin.
- Teacher mode never renders TEST controls, including for Souhail Souai.
- TEST attendance/grades/comments never appear in real reports.
- TEST remains available permanently, even after real planning finalization.
- Applying TEST→RÉEL cannot alter started or completed sessions.

---

### Task 1: Persist explicit active role and enforce UI separation

**Files:**
- Create: `web/v16-active-role.js`
- Modify: `web/access-control.js`
- Create: `tests/web/v16-active-role.test.cjs`

**Interfaces:**
- Produces `V16ActiveRole.get() -> 'admin'|'teacher'`.
- Produces `V16ActiveRole.set(role)` and emits `v16:role-changed`.

- [ ] Write failing tests proving dual-role accounts can switch active role and that teacher role hides every Admin/TEST control regardless of user name.
- [ ] Run focused test and verify FAIL.
- [ ] Implement active-role state and permission predicates; do not special-case any person by name/email.
- [ ] Re-run focused test and verify PASS.
- [ ] Commit `feat(v16): add explicit active role`.

### Task 2: Add TEST-context persistence and reset RPC

**Files:**
- Create: `supabase/migrations/20260903_v16_test_context.sql`
- Create: `tests/web/v16-test-context-sql.test.cjs`

**Interfaces:**
- Context values: `real`, `test`.
- RPC `v16_reset_test_context() -> jsonb`.

- [ ] Write failing SQL tests requiring Admin for TEST writes, rejecting teacher TEST access, and ensuring reset deletes only TEST attendance/grades/comments/session-state/scenario data.
- [ ] Run focused test and verify FAIL.
- [ ] Implement context-scoped storage/policies and reset transaction with audit event.
- [ ] Re-run focused test and verify PASS.
- [ ] Commit `feat(v16): isolate permanent test context`.

### Task 3: Add interactive RÉEL ⇄ TEST switch for Admin only

**Files:**
- Create: `web/v16-test-mode.js`
- Modify: `web/v16-planning-ui.js`
- Create: `tests/web/v16-test-mode.test.cjs`

**Interfaces:**
- Produces `V16TestMode.getContext()`, `setContext('real'|'test')`, `resetTest()`.

- [ ] Write failing UI tests for a highly visible Admin-only `MODE RÉEL ⇄ MODE TEST` control, context badge, reset button, confirmation state, and complete absence in teacher role.
- [ ] Run focused test and verify FAIL.
- [ ] Implement switch with explicit visual context and no page reload.
- [ ] Route planning/session/attendance test actions through TEST-context RPCs only when TEST is active.
- [ ] Re-run focused test and verify PASS.
- [ ] Commit `feat(v16): add permanent admin test mode`.

### Task 4: Apply validated TEST teacher scenario to RÉEL

**Files:**
- Create: `supabase/migrations/20260903_v16_apply_test_to_real.sql`
- Modify: `web/v16-test-mode.js`
- Extend: `tests/web/v16-test-context-sql.test.cjs`
- Extend: `tests/web/v16-test-mode.test.cjs`

**Interfaces:**
- RPC `v16_apply_test_teacher_plan(p_effective_date date) -> jsonb`.
- Return `{ok, affected_sessions, effective_date, blockers, warnings}`.

- [ ] Write failing SQL tests proving only teacher assignments are transferable, weekly rules are revalidated, and started/completed RÉEL sessions remain unchanged.
- [ ] Write failing UI tests for preview summary `configuration actuelle → proposée → date d’effet → semaines → anomalies` and explicit confirm action.
- [ ] Run focused tests and verify FAIL.
- [ ] Implement transactional preview/apply logic and detailed audit event.
- [ ] Re-run focused tests and verify PASS.
- [ ] Commit `feat(v16): apply validated test scenarios to real`.

### Task 5: Separation regression gate

- [ ] Run `node --test tests/web/v16-active-role.test.cjs tests/web/v16-test-context-sql.test.cjs tests/web/v16-test-mode.test.cjs tests/web/attendance-policy.test.cjs tests/web/report-grade-only.test.cjs`.
- [ ] Verify teacher-role markup contains neither `MODE TEST` nor reset/apply controls.
- [ ] Build standalone HTML and verify success.
