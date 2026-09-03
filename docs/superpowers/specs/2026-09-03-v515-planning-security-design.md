# V5.15 Planning, Security, Tests and Migration Design

## Baseline

V5.13 is immutable and remains the canonical stable baseline. V5.15 is additive and must not rewrite V5.13 historical data, completed attendance sessions, grade history, exports, or the `release/v5.13` branch.

## Source planning data

The 2026/2027 planning is defined from the three supplied workbooks:

- Monday: MPI1-A / MPI1-E, starting with MPI1-A on 2026-09-14.
- Thursday: MPI1-C / MPI1-D, starting with MPI1-C.
- Friday: MPI1-B / PC1-A, starting with MPI1-B.

A pedagogical session advances the M1-M6 rotation only when a TP session actually occurs. Holidays, rest weeks, cancellations, and explicit no-TP dates do not consume a rotation step.

For four groups, the initial sequence is G1=M1, G2=M2, G3=M3, G4=M4 and each subsequent effective session advances one manipulation cyclically.

## Lifecycle

Planning uses four states:

1. `draft`: mutable unless it would rewrite a completed historical session.
2. `published`: dates/classes/groups/manipulations visible to teachers. Incomplete teacher assignment and incomplete M1-M6 cycles are warnings, not blockers.
3. `assignments_finalized`: every mandatory teaching post is covered and all assignment rules pass.
4. `cycle_closed`: every group has completed M1-M6 exactly once, unless an explicit Admin waiver is recorded.

## Roles

Teacher:
- view compatible sessions;
- create/cancel own requests;
- view own assignments and quota;
- attendance on own session before closure only;
- grades on own session before and after closure.

Admin:
- configure classes/groups, slots, alternating class pairs, teachers, quotas, allowed manipulations, rotations;
- validate requests and make direct assignments;
- manage attendance before and after closure;
- finalize assignments and close cycles.

## Database security

Critical checks live in PostgreSQL/Supabase, not only in the client. No `service_role` key is exposed in Web, Windows, or Android clients.

All new public-schema tables use RLS. Policies authorize by authenticated user identity and ownership/admin role. Authorization must not trust user-editable JWT metadata. Privileged functions must be narrowly scoped; `SECURITY DEFINER` is avoided unless strictly required, and any such function must perform explicit `auth.uid()` checks and have restricted EXECUTE grants.

## Additive V5.15 model

Use `v515_*` objects only for new planning behavior. Core entities:

- `v515_cycles`: academic cycle and lifecycle status.
- `v515_class_pairs`: weekday/slot alternating class pair and next expected class.
- `v515_groups`: cycle groups 1-6.
- `v515_manipulations`: M1-M6 catalog.
- `v515_group_rotation`: expected manipulation per group/session index.
- `v515_sessions`: effective or calendar-block session records, with status and immutable historical link when completed.
- `v515_teacher_constraints`: quota and allowed manipulations.
- `v515_requests`: teacher requests.
- `v515_assignments`: validated/direct assignments.
- `v515_waivers`: explicit Admin cycle-closure exceptions.
- `v515_audit_log`: important business/security errors and privileged actions.

## RPC/business checks

Server-side operations enforce:

- teacher request ownership;
- teacher quota;
- allowed manipulation;
- no double assignment in overlapping slots;
- no duplicate mandatory post assignment;
- session lifecycle compatibility;
- immutable completed sessions;
- rotation consistency;
- transactionality for validation/finalization.

Expected errors include:

- `Quota enseignant atteint.`
- `Enseignant déjà affecté sur ce créneau.`
- `Manipulation M4 non autorisée pour cet enseignant.`
- `Cette séance a déjà été attribuée.`
- `Rotation incohérente avec le cycle M1-M6.`
- `Impossible de finaliser : N postes restent sans enseignant.`

## Global planning verification

Publication blockers:
- invalid date/slot;
- missing class/group/manipulation identity;
- impossible duplicate group/session;
- inconsistent rotation;
- attempted modification of completed session.

Publication warnings:
- group has fewer than six scheduled manipulations;
- expected manipulation not yet scheduled;
- teacher post still vacant.

Assignment-finalization blockers:
- double teacher assignment;
- quota exceeded;
- disallowed manipulation;
- time conflict;
- mandatory teaching post vacant.

Cycle-closure blockers:
- any group has not completed M1-M6 exactly once;
- duplicate manipulation in the same group cycle;
- missing M1-M6 without explicit Admin waiver.

## Attendance and grades non-regression

Preserve V5.13 behavior:
- teacher attendance editable only before session closure on own session;
- Admin attendance editable before and after closure;
- grades editable before and after closure by owning teacher and Admin;
- presence sheet always renders either the student list or an explicit empty-group state.

## Migration

`V5.13 stable` -> add `v515_*` schema/RPC -> add V5.15 UI -> import/configure 2026/2027 planning -> regression tests -> security/business tests -> enable new engine.

Existing historical V5.13 records are not rewritten. New configurable group counts primarily apply to new pedagogical cycles.

## Acceptance criteria

- V5.13 reference SHA and branch remain unchanged.
- 1-6 groups supported.
- M1-M6 rotation works through holidays/cancellations without consuming a step.
- alternating Monday/Thursday/Friday class pairs follow the supplied planning.
- incomplete cycles can be published but cannot be pedagogically closed without completion/waiver.
- teacher requests and assignments satisfy quota, allowed-manipulation, ownership and conflict rules server-side.
- attendance/grade V5.13 tests remain green.
- no client contains a `service_role` key.
