# V16 Teacher Weekly Rules and Permutations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce 4 teachers per teaching day and exactly 2 teaching days per week per teacher, while allowing Admin-only weekly or permanent future permutations.

**Architecture:** Add server-authoritative weekly assignment constraints and permutation RPCs, then expose focused interactive Admin controls in the native planning tab. Past/started sessions remain immutable.

**Tech Stack:** PostgreSQL/Supabase RPC, vanilla JavaScript, Node.js SQL contract tests.

**Spec:** `docs/superpowers/specs/2026-09-03-v16-planning-design.md`

## Global Constraints

- Admin-only writes.
- 4 teachers Monday, 4 Thursday, 4 Friday.
- Exactly 2 teaching days per week per teacher.
- No duplicate teacher within one day and no time conflict.
- Permanent permutation affects only future non-started sessions.

---

### Task 1: Define weekly teacher policy in SQL

**Files:**
- Create: `supabase/migrations/20260903_v16_teacher_weekly_policy.sql`
- Create: `tests/web/v16-teacher-weekly-sql.test.cjs`

**Interfaces:**
- Produces RPC `v16_verify_teacher_week(p_week_start date, p_context text default 'real') -> jsonb`.

- [ ] Write failing SQL-contract tests asserting Admin gate, 4/day, 2 days/week/teacher, duplicate-day rejection, conflict rejection, and Africa/Tunis start-time locking.
- [ ] Run `node --test tests/web/v16-teacher-weekly-sql.test.cjs` and verify FAIL.
- [ ] Implement migration and RPC with explicit `search_path=''`, transaction-safe checks and audit events.
- [ ] Re-run focused test and verify PASS.
- [ ] Commit `feat(v16): enforce weekly teacher policy`.

### Task 2: Add weekly and permanent permutation RPCs

**Files:**
- Create: `supabase/migrations/20260903_v16_teacher_permutations.sql`
- Extend: `tests/web/v16-teacher-weekly-sql.test.cjs`

**Interfaces:**
- Produces `v16_swap_teachers(p_teacher_a uuid, p_day_a int, p_teacher_b uuid, p_day_b int, p_effective_date date, p_scope text, p_context text default 'real') -> jsonb`.
- `p_scope` accepts `week` or `future`.

- [ ] Add failing tests for week-only swap, permanent future swap, invalid weekly totals, started-session protection, and audit logging.
- [ ] Run focused test and verify FAIL.
- [ ] Implement the RPC so all touched assignments are validated before any mutation is committed.
- [ ] Re-run focused test and verify PASS.
- [ ] Commit `feat(v16): add teacher permutation transactions`.

### Task 3: Add interactive Admin permutation controls

**Files:**
- Create: `web/v16-teacher-permutations.js`
- Modify: `web/v16-planning-ui.js`
- Create: `tests/web/v16-teacher-permutations.test.cjs`

**Interfaces:**
- Produces `V16TeacherPermutations.render(state)` and `V16TeacherPermutations.submitSwap(input)`.

- [ ] Write failing UI-contract tests for `Permuter`, source teacher/day, target teacher/day, scope `Cette semaine` / `Toutes les semaines futures`, effective date, validation summary and confirm action.
- [ ] Run focused test and verify FAIL.
- [ ] Implement controls visible only when active role is Admin.
- [ ] Display live policy summary: teacher → selected weekdays; day → count/4; blocking violations before submit.
- [ ] Run focused test and build tests; verify PASS.
- [ ] Commit `feat(v16): add interactive teacher permutations`.

### Task 4: Regression gate

- [ ] Run `node --test tests/web/v16-teacher-weekly-sql.test.cjs tests/web/v16-teacher-permutations.test.cjs tests/web/attendance-policy.test.cjs tests/web/baseline.test.cjs`.
- [ ] Build standalone Web artifact with `python scripts/build_single_file_release.py`.
- [ ] Verify no teacher-mode DOM contains `Permuter`, weekly policy editing, or Admin assignment actions.
