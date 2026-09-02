# V5.15 design: configurable groups, fortnight rotation, and teacher session selection

Date: 2026-09-02
Branch: `feature/v5.15-session-selection`
Implementation baseline: current `main` at `b01df636f703d79cb17a121f3178186782595f83`, so V5.15 includes the latest verified V5.13-compatible fixes already merged on `main`.
Rollback reference: immutable `release/v5.13`.

## 1. Architectural decision

V5.15 extends the existing V5 application rather than creating a separate application. The stable attendance, grades, users, history, exports, and corrected V5.13-compatible behavior already present on `main` remain protected. New planning and teacher-selection behavior is isolated behind V5.15-specific data structures, RPCs, and UI modules.

The selected approach is modular evolution: retain the stable V5 core and add an independent `Planning / Choix des séances` subsystem inside the same application.

V5.15 uses the existing application authentication and teacher identities. It does not create a second authentication store. A V5.15 teacher configuration references an existing teacher account; when the administrator adds a new teacher, the existing account-creation flow is used and the V5.15 quota/manipulation profile is attached to that account.

## 2. Goals

V5.15 must:

1. Keep the same class catalogue used by V5.13, including the existing MPI1 and PC1 classes.
2. Allow the administrator to configure the number of groups separately for each class from 1 to 6, with 4 groups as the default.
3. Keep six manipulations, `M1` through `M6`.
4. Ensure every group completes all six manipulations exactly once per pedagogical cycle.
5. Schedule each group on a fortnight basis.
6. Allow an administrator to define arbitrary Week A / Week B class pairs for each timeslot.
7. Allow the administrator to create arbitrary dates, start/end times, and rooms, including exceptional or catch-up sessions.
8. Generate the manipulation rotation automatically.
9. Let teachers request specific session positions consisting of class, date/time, group, manipulation, and room.
10. Allow several teachers to request the same position.
11. Require administrator validation before an assignment becomes final.
12. Allow direct administrator assignment when no request exists.
13. Support an individual teaching quota for each teacher.
14. Support an administrator-managed set of allowed manipulations for each teacher.
15. Prevent double assignment of one teacher within overlapping timeslots.
16. Preserve all historical and already-realized sessions.
17. Finalize V5.15 planning into the existing attendance/grades workflow only after validation.

## 3. Explicit non-goals

- No rewrite of stable V5 attendance or grade-entry rules.
- No second teacher authentication system.
- No automatic modification of already-realized or closed sessions.
- No unrestricted manual editing of generated manipulation rotations.
- No client-side-only enforcement of quotas or assignment constraints.
- No exposed Supabase `service_role` key.

## 4. Pedagogical model

### Classes and groups

Each class has a configurable group count from 1 to 6. Four groups is the default. Group identifiers are `G1` through `G6` as required by that class configuration.

Each global class session contains one concrete session position per active group. Therefore a four-group class requires four simultaneous teacher assignments, one for each group position.

### Manipulations

The application always keeps six manipulations: `M1`, `M2`, `M3`, `M4`, `M5`, and `M6`.

If a class has four groups, four different manipulations are active simultaneously during a class session. If it has five or six groups, five or six different manipulations are active respectively. No two groups of the same class may perform the same manipulation during the same global session.

### Fortnight model

Every group has one pedagogical TP session every two weeks. A recurring timeslot may pair two classes:

- Week A -> Class A
- Week B -> Class B

The administrator defines these pairs freely for each timeslot. The pairing is configuration data and is not hard-coded.

Each class advances through its own manipulation cycle only when that class actually has its pedagogical session.

### Rooms

Room remains a property of each concrete session position. Generation reuses the existing V5 room configuration where a compatible mapping exists. Before a cycle is opened for teacher requests, the administrator may set or override the room for future positions. A room change never rewrites realized history.

## 5. Rotation engine

The default rotation is deterministic and cyclic. For pedagogical session number `k` and group index `i`, both starting at 1:

`manipulation = ((i + k - 2) mod 6) + 1`

For four groups this gives:

| Pedagogical session | G1 | G2 | G3 | G4 |
| --- | --- | --- | --- | --- |
| 1 | M1 | M2 | M3 | M4 |
| 2 | M2 | M3 | M4 | M5 |
| 3 | M3 | M4 | M5 | M6 |
| 4 | M4 | M5 | M6 | M1 |
| 5 | M5 | M6 | M1 | M2 |
| 6 | M6 | M1 | M2 | M3 |

This guarantees that every group performs each of `M1`-`M6` exactly once during a complete six-session cycle and that simultaneous groups use distinct manipulations.

### Cancellation and catch-up

A cancelled session does not advance the rotation. A catch-up session inherits the cancelled session's class, affected groups, pedagogical session number, and manipulations. Its date/time may be different.

### Group-count changes

Group count is freely configurable while a class cycle is in `DRAFT`.

After the cycle is opened for requests, group count cannot be edited directly. If no session has reached `FINALIZED` or `REALIZED`, the administrator may explicitly reset the cycle to `DRAFT`; this cancels pending requests, removes non-final draft assignments, records the reset in the audit log, and then permits regeneration with the new group count.

Once any session in that class cycle reaches `FINALIZED` or `REALIZED`, a group-count change applies only to the next pedagogical cycle. Historical finalized/realized data is never rewritten.

### Exceptional rotation change

The administrator may use a controlled exceptional-rotation action. The server must reject the change if it creates duplicate simultaneous manipulations, repeats a manipulation already completed by a group in the current cycle, or makes completion of all six manipulations impossible.

## 6. V5.15 data model

New V5.15 behavior is stored in additive tables rather than directly rewriting stable V5 planning tables during the draft/selection stage.

Recommended structures:

- `v515_class_config`: class, group count, active flag.
- `v515_timeslots`: recurring or exceptional date/day, start time, end time, active flag.
- `v515_fortnight_pairs`: timeslot plus Week A class and Week B class.
- `v515_rotation`: generated pedagogical-session/group/manipulation state.
- `v515_teacher_config`: reference to existing teacher identity, individual quota, active flag.
- `v515_teacher_manipulations`: allowed `M1`-`M6` per teacher.
- `v515_session_positions`: concrete class/date/time/group/manipulation/room positions.
- `v515_requests`: teacher requests for a session position.
- `v515_assignments`: administrator-validated assignments.
- `v515_audit_log`: sensitive configuration and assignment history.

Several request records may target one session position, but one session position may have at most one validated assignment.

Database constraints and RPC checks must enforce uniqueness of a session position, uniqueness of its validated assignment, and non-overlap of validated assignments for one teacher.

## 7. Teacher workflow

After authentication, a teacher sees:

- individual total quota;
- validated assignments;
- pending requests;
- remaining quota;
- allowed manipulations;
- upcoming validated sessions.

The `Séances disponibles` view exposes only eligible session positions. A position is identified by class, date, time, group, manipulation, and room.

A teacher may submit unlimited requests, including requests beyond the numerical quota. Requests do not consume quota. A teacher may submit requests for several positions occurring at the same time, but only one of those overlapping positions may later be validated. A teacher may cancel a request while it remains pending.

Request states are:

`PENDING -> ACCEPTED | REJECTED | CANCELLED`

## 8. Administrator workflow

The administrator can:

- configure class group counts from 1 to 6;
- create arbitrary dates, times, rooms, and timeslots;
- define Week A / Week B class pairs per recurring timeslot;
- generate and preview the automatic rotation;
- add, edit, deactivate, or reactivate teachers through the existing teacher-account model;
- set an individual quota for each teacher;
- set allowed manipulations for each teacher;
- review all competing requests for a position;
- accept one request and automatically reject competing requests;
- reject requests explicitly;
- assign an eligible teacher directly without a prior request;
- run a global planning verification;
- finalize the planning.

Teacher manipulation permissions remain editable by the administrator. Changes are audited and do not silently delete already-validated historical assignments.

## 9. Transactional assignment rules

Accepting a request or performing a direct assignment must use a server-side Supabase/PostgreSQL transaction through an RPC.

Before inserting an assignment, the RPC verifies:

1. the session position still exists and is assignable;
2. the teacher is active;
3. the manipulation is allowed for that teacher;
4. the teacher has remaining validated quota;
5. the teacher has no overlapping validated assignment;
6. the position matches the generated group/manipulation rotation;
7. the position has no existing validated assignment;
8. the relevant planning state permits assignment.

On successful request acceptance, one atomic transaction:

- marks the chosen request `ACCEPTED`;
- creates the validated assignment;
- marks competing requests for the same position `REJECTED`;
- writes an audit event.

If any invariant fails, the full transaction rolls back.

Direct administrator assignment uses the same validation path but does not require a prior request.

## 10. Quota semantics

A teacher quota counts only validated assignments.

`remaining_quota = individual_quota - count(validated_assignments)`

Pending requests never decrement quota. The server blocks validation once the individual quota is exhausted.

## 11. Planning lifecycle

A V5.15 planning cycle follows:

`DRAFT -> OPEN_FOR_REQUESTS -> ASSIGNMENT -> FINALIZED -> REALIZED`

`FINALIZED` means the assignment is published to the operational planning and synchronized to the existing attendance/grades structures. `REALIZED` means the pedagogical session has actually taken place. A realized session is immutable to automatic regeneration or movement.

A cycle may be reset from `OPEN_FOR_REQUESTS` or `ASSIGNMENT` to `DRAFT` only if it contains no `FINALIZED` or `REALIZED` session. The reset cancels pending requests and clears only non-final V5.15 draft assignments transactionally.

Before finalization, `Vérifier le planning` checks at least:

- every planned group has a complete six-manipulation cycle;
- each group has each manipulation exactly once;
- simultaneous groups do not duplicate manipulations;
- no teacher has overlapping validated assignments;
- no teacher quota is exceeded;
- every validated assignment uses an allowed manipulation;
- Week A / Week B alternation is respected;
- no finalized or realized session was changed;
- every mandatory session position has a teacher.

Finalization is blocked while any blocking error remains.

## 12. Integration with stable V5 behavior

The V5.15 subsystem remains authoritative for draft and selection data. Stable attendance and grades do not consume a draft position.

Only finalized V5.15 assignments are synchronized into the structures required by the existing Presence / Notes / Planning workflows. This synchronization must be transactional and additive. Historical sessions remain unchanged.

The `release/v5.13` branch remains the immutable rollback reference, while implementation starts from the latest verified `main` baseline so previously corrected V5 behavior is not lost.

## 13. Security

Supabase RLS and server-side RPCs are authoritative.

A teacher may read eligible session positions, manage only their own pending requests, and read only their own request/assignment data except for explicitly public planning information.

Only administrators may modify group counts, timeslot pairing, teacher quotas, teacher manipulation permissions, rotation exceptions, request decisions, direct assignments, cycle resets, and planning finalization.

Critical authorization and integrity rules must not depend on hidden buttons or browser state.

## 14. Audit history

The system records at least:

- quota changes;
- teacher manipulation-permission changes;
- request acceptance/rejection by an administrator;
- direct administrator assignments;
- rotation exceptions;
- group-count changes;
- cycle resets;
- finalization actions.

Each audit event contains timestamp, actor, action, target, and relevant old/new values when applicable.

## 15. Error handling

User-facing failures must be explicit and domain-specific, for example:

- `Quota enseignant atteint.`
- `Enseignant déjà affecté sur ce créneau.`
- `Manipulation non autorisée pour cet enseignant.`
- `Cette séance est déjà attribuée.`
- `Rotation incohérente avec le cycle M1-M6.`
- `Modification du nombre de groupes impossible après finalisation du cycle.`
- `Finalisation impossible : des postes restent non couverts.`

No partial write is retained after a failed transactional operation.

## 16. Testing and acceptance criteria

### Rotation tests

Test group counts 1 through 6 across a full six-session cycle. Verify each group receives `M1`-`M6` exactly once, simultaneous groups receive distinct manipulations, fortnight pairing advances correctly, cancellation does not advance rotation, and catch-up retains the cancelled rotation state.

### Business-rule tests

Test unlimited requests, competing requests, individual quotas, administrator validation, automatic competitor rejection, direct assignment, manipulation eligibility, teacher deactivation, overlapping-timeslot rejection, cycle reset behavior, and pre-cycle versus post-finalization group-count changes.

### Security tests

Verify a teacher cannot modify another teacher's requests, cannot alter quotas or manipulation permissions, cannot bypass assignment constraints through direct RPC calls, and cannot access administrator-only operations. Verify RLS and RPC authorization together.

### Non-regression tests

Existing V5 authentication, attendance, grades, session closing, history, PDF export, Word export, printing, student/presence fixes already merged on `main`, and existing historical planning must remain functional.

## 17. Migration strategy

Migration is additive:

`latest verified V5 main -> add v515 schema/RPCs -> add V5.15 UI -> test -> activate V5.15 planning -> finalize/synchronize selected planning`

Before activation, retain `release/v5.13` as rollback reference. Existing realized/closed sessions are never migrated destructively.

## 18. Success criteria

V5.15 is acceptable when an administrator can configure 1-6 groups per class, generate a correct fortnight M1-M6 rotation, open positions to teacher requests, validate or directly assign teachers under server-enforced quotas and eligibility rules, verify complete coverage, finalize the planning, and use the finalized sessions in the existing attendance/grades workflow without regression in previously corrected V5 functionality.
