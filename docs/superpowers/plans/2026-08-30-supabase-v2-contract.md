# Supabase V2 Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a backward-compatible, secure Supabase contract shared by Web, Windows, and Android, including MFA-aware authorization, versioned attendance writes, audit history, idempotency, and normalized academic entities.

**Architecture:** Existing production tables remain available during transition. Additive PostgreSQL migrations create the normalized V2 model and compatibility mappings. All attendance-sheet writes use one transaction RPC with revision and operation identifiers. RLS remains authoritative; privileged operations use narrowly granted functions or authenticated Edge Functions.

**Tech Stack:** Supabase hosted PostgreSQL 17, Supabase Auth MFA/TOTP, PL/pgSQL, RLS, Edge Functions/Deno, Realtime, Supabase CLI 2.116.0.

**Spec:** `docs/superpowers/specs/2026-08-30-native-android-supabase-design.md`

## Global Constraints

- Staging project ref: `llxgpdaasdlnmonxqysw`; production project ref: `dbslzmvzbxczpqyektpx`.
- Apply and verify every migration in staging before production.
- Preserve every current production row and UUID.
- No secret/service-role key in a public client or committed file.
- All new public tables have explicit grants, RLS enabled, and explicit policies.
- `SECURITY DEFINER` functions set `search_path = ''`, qualify relation names, validate `auth.uid()`, and receive explicit grants only.
- Attendance status values are `present`, `absent`, `retard`, `justifie`.
- Grade range is inclusive `[0,20]`.
- Writes are atomic, revision-checked, idempotent, and audited.
- Realtime is notification-only; clients reload canonical rows.

---

### Task 1: Create the additive V2 schema

**Files:**
- Create: `supabase/migrations/20260830190000_v2_core_schema.sql`
- Create: `supabase/tests/v2_schema.sql`

**Interfaces:**
- Produces tables `academic_years`, `courses`, `student_groups`, `enrollments`, `teacher_assignments`, `timetable_entries`, `attendance_sheets`, `operation_receipts`, `audit_logs`, `app_config`, and `legacy_entity_map`.
- Adds `revision bigint not null default 1`, `deleted_at timestamptz`, and `updated_by uuid` where required on legacy business tables.

- [ ] Write `supabase/tests/v2_schema.sql` assertions using `do $$ begin ... end $$` blocks that fail when a required table, column, unique constraint, foreign key, or check constraint is absent.
- [ ] Run the assertions in staging and confirm failure before migration.
- [ ] Write the migration with UUID primary keys, UTC timestamps, check constraints, indexes on all RLS ownership predicates, and explicit `GRANT` statements.
- [ ] Apply migration SQL to staging.
- [ ] Re-run assertions and confirm success.
- [ ] Commit migration and tests.

### Task 2: Backfill normalized academic data without changing legacy rows

**Files:**
- Create: `supabase/migrations/20260830191000_v2_backfill.sql`
- Create: `supabase/tests/v2_backfill.sql`

**Interfaces:**
- Maps every legacy `classes.id` to a `student_groups.id`, `courses.id`, `teacher_assignments.id`, and optional `timetable_entries.id` through `legacy_entity_map`.
- Maps every legacy student to an enrollment and every legacy session to an attendance sheet.

- [ ] Add staging fixtures matching the current production shapes.
- [ ] Write assertions for row-count preservation, stable legacy UUID mapping, no orphan records, and one attendance sheet per session.
- [ ] Run assertions and confirm expected failure.
- [ ] Implement idempotent `insert ... on conflict` backfill SQL.
- [ ] Execute the backfill twice in staging and verify identical counts after both executions.
- [ ] Commit migration and tests.

### Task 3: Add authorization helpers and harden RLS

**Files:**
- Create: `supabase/migrations/20260830192000_v2_security.sql`
- Create: `supabase/tests/v2_rls.sql`

**Interfaces:**
- Produces private helper functions `private.current_app_role()`, `private.is_admin()`, `private.current_aal()`, `private.can_access_legacy_class(uuid)`, `private.can_access_session(uuid)`, and `private.require_aal2()`.
- Produces a safe `public.teacher_directory_v2` security-invoker view.

- [ ] Write RLS tests for anonymous, teacher A, teacher B, administrator AAL1, and administrator AAL2 contexts by setting request JWT claims in a transaction.
- [ ] Confirm teacher A cannot address teacher B rows by UUID.
- [ ] Replace broad policies with ownership/assignment predicates and matching `USING` plus `WITH CHECK` clauses.
- [ ] Allow profile self-read at AAL1 so MFA enrollment can complete; require AAL2 for business mutations and privileged reads.
- [ ] Revoke all client privileges on `admin_pin_credentials`, `admin_pin_attempts`, and `super_admin_owner`; retain service-role access only.
- [ ] Replace public `teacher_directory()` execution with `teacher_directory_v2` and revoke the unsafe RPC.
- [ ] Run Supabase security advisors and RLS tests; resolve all ERROR/WARN findings introduced by the migration.
- [ ] Commit migration and tests.

### Task 4: Implement transactional attendance sheets

**Files:**
- Create: `supabase/migrations/20260830193000_v2_attendance_rpc.sql`
- Create: `supabase/tests/v2_attendance_rpc.sql`

**Interfaces:**
- Produces `public.get_attendance_sheet(p_session_id uuid)`.
- Produces `public.save_attendance_sheet(p_session_id uuid, p_expected_revision bigint, p_operation_id uuid, p_records jsonb, p_justification text default null)` returning JSON with `ok`, `revision`, `operation_id`, `records`, and stable error code.

- [ ] Write tests for valid save, duplicate student input, unauthorized session, stale revision, invalid grade/status, idempotent replay, and atomic rollback.
- [ ] Confirm tests fail before implementation.
- [ ] Implement the RPC using row locking on `attendance_sheets`, validation against enrolled students, one transaction, one revision increment, one operation receipt, and one audit entry.
- [ ] Return `VERSION_CONFLICT` without modifying business rows when the expected revision differs.
- [ ] Grant RPC execution to `authenticated`; revoke from `anon` and `PUBLIC`.
- [ ] Run all RPC tests twice and confirm idempotent results.
- [ ] Commit migration and tests.

### Task 5: Implement common configuration and error contract

**Files:**
- Create: `supabase/migrations/20260830194000_v2_app_contract.sql`
- Create: `supabase/tests/v2_app_contract.sql`

**Interfaces:**
- Produces `public.get_app_contract()` returning schema version, maintenance state, minimum Web/Windows/Android versions, MFA policy, and server time.
- Stable error codes: `NETWORK_UNAVAILABLE`, `UNAUTHENTICATED`, `SESSION_EXPIRED`, `MFA_REQUIRED`, `FORBIDDEN`, `VALIDATION_ERROR`, `VERSION_CONFLICT`, `RATE_LIMITED`, `SERVER_UNAVAILABLE`, `INTERNAL_ERROR`.

- [ ] Seed `app_config` with schema version `2`, academic year `2026/2027`, and release-version fields.
- [ ] Implement security-invoker read access for authenticated clients.
- [ ] Add tests for returned keys, types, and maintenance/version behavior.
- [ ] Commit migration and tests.

### Task 6: Upgrade admin authentication Edge Functions

**Files:**
- Create: `supabase/functions/admin-pin-login/index.ts`
- Create: `supabase/functions/admin-teacher/index.ts`
- Create: `supabase/functions/_shared/http.ts`
- Create: `supabase/tests/edge_contract.cjs`

**Interfaces:**
- Login response includes `access_token`, `refresh_token`, `expires_in`, `user_id`, `role`, `mfa_required`, and `correlation_id`.
- Privileged admin operations reject sessions below AAL2.

- [ ] Pin `@supabase/supabase-js` to an exact version.
- [ ] Keep login error text generic and apply per-account/per-network rate limits.
- [ ] Return session tokens only after successful server-side PIN/password verification.
- [ ] Require JWT verification on `admin-teacher`; independently validate role and AAL2 in function body.
- [ ] Add OPTIONS/CORS handling without wildcard credential exposure.
- [ ] Deploy functions to staging and run contract tests.
- [ ] Commit function source and tests.

### Task 7: Staging verification and production migration

**Files:**
- Create: `supabase/tests/run_all.sql`
- Create: `docs/releases/2026-08-30-supabase-v2-verification.md`

**Interfaces:**
- Produces a recorded staging verification report and reversible production rollout order.

- [ ] Run all schema, backfill, RLS, RPC, Edge Function, advisor, and row-count checks in staging.
- [ ] Record exact counts and advisor output without personal data.
- [ ] Capture production metadata and counts immediately before migration.
- [ ] Apply migrations to production in order.
- [ ] Deploy Edge Functions to production.
- [ ] Run production smoke queries and compare pre/post row counts.
- [ ] Record rollback commands and final verification evidence.
- [ ] Commit the verification report.

## Completion Gate

- Staging tests pass with no unadjudicated security warning introduced by V2.
- Production legacy row counts and UUIDs are preserved.
- Cross-teacher direct UUID access is denied.
- Attendance writes are atomic, revision-checked, idempotent, and audited.
- Business mutations require AAL2.
- Current legacy read paths continue to function until client cutover.
