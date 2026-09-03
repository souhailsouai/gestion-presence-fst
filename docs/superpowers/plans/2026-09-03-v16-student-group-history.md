# V16 Student Group History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add effective-dated student group membership so future rosters follow group changes without rewriting historical attendance.

**Architecture:** Keep existing students/classes as the identity/source tables, add an effective-dated membership history table and server RPCs, then resolve the applicable group by session date. The V5.13 attendance rows remain historical facts and are never reassigned retroactively.

**Tech Stack:** PostgreSQL/Supabase RPC/RLS, vanilla JavaScript, Node.js contract tests.

**Spec:** `docs/superpowers/specs/2026-09-03-v16-planning-design.md`

## Global Constraints

- Admin chooses G1–G4 manually.
- Membership changes have explicit effective dates.
- New students appear only from their effective date.
- Inactive/left students disappear only from the effective end date.
- Historical attendance, grades and comments remain untouched.

---

### Task 1: Add effective-dated membership storage

**Files:**
- Create: `supabase/migrations/20260903_v16_student_group_history.sql`
- Create: `tests/web/v16-student-group-sql.test.cjs`

**Interfaces:**
- Table `v16_student_group_memberships(student_id, class_id, group_no, effective_from, effective_to, active, changed_by, created_at)`.
- RPC `v16_set_student_group(p_student_id uuid, p_class_id uuid, p_group_no int, p_effective_from date) -> jsonb`.
- RPC `v16_end_student_membership(p_student_id uuid, p_effective_to date) -> jsonb`.

- [ ] Write failing SQL-contract tests for Admin-only mutation, group range 1–4, non-overlapping membership periods, audit identity/date, and no direct teacher mutation.
- [ ] Run `node --test tests/web/v16-student-group-sql.test.cjs` and verify FAIL.
- [ ] Implement migration, RLS/policies and transaction-safe RPCs.
- [ ] Re-run focused test and verify PASS.
- [ ] Commit `feat(v16): add effective-dated student groups`.

### Task 2: Resolve session roster by date

**Files:**
- Create: `supabase/migrations/20260903_v16_session_rosters.sql`
- Extend: `tests/web/v16-student-group-sql.test.cjs`

**Interfaces:**
- RPC `v16_students_for_session(p_session_id uuid, p_context text default 'real') -> setof ...`.

- [ ] Add failing tests showing a student in G2 before 12/10 and G3 from 12/10 appears in the correct dated session only.
- [ ] Add failing tests for newly added, inactive and reactivated students.
- [ ] Run focused test and verify FAIL.
- [ ] Implement resolver using session date + effective membership window; do not update old attendance rows.
- [ ] Re-run focused test and verify PASS.
- [ ] Commit `feat(v16): resolve dated session rosters`.

### Task 3: Make Étudiants interactive with history controls

**Files:**
- Create: `web/v16-student-groups.js`
- Modify: `web/online-fixes.js`
- Create: `tests/web/v16-student-groups.test.cjs`

**Interfaces:**
- Produces `V16StudentGroups.renderClassGroups(data)`.
- Produces `V16StudentGroups.changeGroup({studentId,classId,groupNo,effectiveFrom})`.
- Produces `V16StudentGroups.showHistory(studentId)`.

- [ ] Write failing UI tests for class-separated blocks, G1–G4 selectors, effective-date input, status action, and `Historique des affectations`.
- [ ] Run focused test and verify FAIL.
- [ ] Implement the controls in the existing V5.13 visual language; changes refresh authoritative state after RPC success.
- [ ] Render history chronologically as `Gx du dd/mm/yyyy au dd/mm/yyyy` / `Gy à partir du ...`.
- [ ] Re-run focused test and verify PASS.
- [ ] Commit `feat(v16): add interactive student group history`.

### Task 4: Attendance regression gate

- [ ] Run `node --test tests/web/v16-student-group-sql.test.cjs tests/web/v16-student-groups.test.cjs tests/web/attendance-policy.test.cjs tests/web/report-grade-only.test.cjs`.
- [ ] Verify no migration updates historical attendance `student_id`, `session_id`, grade or status rows when group membership changes.
- [ ] Build standalone HTML and verify success.
