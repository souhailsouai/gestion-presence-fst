# V17 — Google Sheets Synchronization for Planning, Teachers, and Students

## Status

Design approved in conversation on 2026-09-05. This specification defines the V17 architecture. It does not alter the immutable V5.13 baseline and does not remove or weaken any V16 behavior.

## Goal

Add a secure Google Sheets synchronization layer to the existing attendance application so an administrator can maintain:

- teachers,
- students and their class/group membership,
- official TP planning,

from one private Google Sheet, while preserving V16 planning validation, TEST/REAL separation, attendance history, grades, comments, authorization rules, and auditability.

The standalone HTML remains an online client. Google credentials and privileged database credentials must never be embedded in the HTML.

## Source material analyzed

The six supplied 2026/2027 Excel workbooks are treated as the functional reference for the initial V17 Google Sheet structure.

Planning workbooks:

- MPI1-A / MPI1-E — Monday,
- MPI1-C / MPI1-D — Thursday,
- MPI1-B / PC1-A — Friday.

Attendance workbooks:

- each attendance workbook contains one `Planning` sheet plus eight group sheets,
- the six classes are MPI1-A, MPI1-B, MPI1-C, MPI1-D, MPI1-E, and PC1-A,
- each class has G1–G4,
- each group sheet reserves 12 student rows,
- the current supplied student-name cells are blank,
- planning rows encode the existing M1–M6 rotation and room information.

V17 will normalize this document-oriented layout into table-oriented Google Sheet tabs suitable for safe synchronization.

## Non-negotiable compatibility rules

V17 must preserve all existing V16/V5.13 business behavior unless explicitly extended here.

### Presence and grades

- Presence before closure: teachers and admins.
- Presence after closure: admins only.
- Comments after closure: locked for teachers, editable by admins.
- Grades before and after closure: teachers and admins.
- Historical attendance, comments, grades, and completed-session records are never deleted by synchronization.

### Planning

- Existing V16 TEST/REAL separation remains authoritative.
- Google Sheets cannot silently overwrite REAL planning.
- All room, teacher, manipulation-history, weekly-distribution, class/group, calendar, and concurrency checks remain enforced server-side.
- 2026/2027 official calendar rules already reconciled in V16 remain valid.

### Security

- No `service_role` or Google service-account private key in browser code.
- Google Sheet must be private, not published publicly.
- Only admins may configure a sync source, request synchronization, inspect all diffs, or apply changes to REAL.
- Critical mutations remain transactional and server validated.
- V17 writes must be audited with actor, source batch, timestamp, and before/after meaning where applicable.

## Recommended architecture

```text
Private Google Sheet
        |
        v
Supabase Edge Function: v17-google-sheet-sync
        |
        v
V17 staging / TEST batch
        |
        +--> normalization + validation + diff
        |
        v
Admin V17 Sync Center
        |
        +--> reject / refresh / inspect
        |
        +--> load planning into V16 TEST
        |
        v
Admin explicit Apply to REAL
        |
        v
Existing authoritative Supabase tables + V16 planning/session flow
        |
        v
HTML refresh / Realtime update
```

The Google Sheet is an administrative source, not the operational database. Supabase remains the runtime source of truth consumed by the Web application.

## Google Sheet workbook design

V17 creates one native private Google Sheet with four required tabs.

### 1. `Enseignants`

Columns:

| Column | Required | Meaning |
| --- | --- | --- |
| `Code` | yes | Stable administrative key, e.g. `ENS001` |
| `Nom` | yes | Family name |
| `Prenom` | yes | Given name |
| `Email` | yes for login-capable teacher | Login/matching email |
| `Actif` | yes | `Oui` / `Non` |
| `Peut_se_connecter` | yes | `Oui` / `Non` |
| `Commentaire` | no | Administrative note |

Rules:

- `Code` is immutable once associated with a production teacher.
- Email is normalized case-insensitively.
- Adding a row does not automatically create an Auth account.
- `Peut_se_connecter=Oui` requires a resolvable existing Auth/profile identity before REAL apply.
- Deactivation removes the teacher from future planning eligibility but does not rewrite historical sessions.

### 2. `Etudiants`

Columns:

| Column | Required | Meaning |
| --- | --- | --- |
| `Matricule` | yes | Stable student identifier |
| `Nom` | yes | Family name |
| `Prenom` | yes | Given name |
| `Email` | no | Student email |
| `Classe` | yes | One of MPI1-A, MPI1-B, MPI1-C, MPI1-D, MPI1-E, PC1-A |
| `Groupe` | yes | G1, G2, G3, or G4 |
| `Actif` | yes | `Oui` / `Non` |
| `Date_effet` | yes | Effective date for membership change |

Rules:

- `Matricule` is the primary synchronization key; names are never used as the sole identity key.
- New students appear from `Date_effet`.
- Group changes create a new effective-dated membership using the existing V16 membership model.
- `Actif=Non` ends the current membership from the effective date; it does not delete the student or historical records.
- A student cannot have overlapping active memberships.
- Unknown class/group values block the row.
- Duplicate matricules within one sync batch block the batch.

### 3. `Planning`

Columns:

| Column | Required | Meaning |
| --- | --- | --- |
| `Date` | yes | TP date |
| `Debut` | yes | `HH:MM` |
| `Fin` | yes | `HH:MM` |
| `Classe` | yes | Official class |
| `Groupe` | yes | G1–G4 |
| `Enseignant_Code` | yes | Foreign key to `Enseignants.Code` |
| `Manipulation` | yes | M1–M6 |
| `Salle` | yes | A–D |
| `Actif` | yes | `Oui` / `Non` |

Rules:

- Planning rows are normalized one assignment per row.
- V16 remains authoritative for calendar and manipulation-history validation.
- A valid import may populate/update V16 TEST only; REAL requires explicit Admin apply.
- Holiday/DS/non-teaching dates cannot be reactivated by a spreadsheet row without an explicit future V17 calendar-change feature; in V17 initial scope they are blockers.

### 4. `Parametres`

Key/value table containing:

- academic year,
- semester,
- source version,
- timezone `Africa/Tunis`,
- synchronization enabled flag,
- optional administrator note.

This tab is not used to weaken database-side constraints.

## Synchronization behavior

### Trigger modes

V17 supports both:

1. `Synchroniser maintenant` in the Admin Sync Center for immediate pull.
2. Background pull every 5 minutes when synchronization is enabled.

A background pull only creates or refreshes a staging batch. It never applies REAL mutations automatically.

### Batch model

Each pull creates a V17 sync batch containing:

- source spreadsheet id,
- source revision/fingerprint,
- fetched-at timestamp,
- initiating mode (`manual` or `scheduled`),
- normalized teacher rows,
- normalized student rows,
- normalized planning rows,
- validation results,
- computed diff against current authoritative data,
- lifecycle state.

Proposed states:

- `fetched`,
- `invalid`,
- `validated`,
- `loaded_to_test`,
- `applied`,
- `rejected`,
- `superseded`.

Only the latest validated non-superseded batch may be loaded/applied.

## Database additions

V17 adds new tables without modifying V5.13 semantics.

### `v17_sync_sources`

Stores non-secret source configuration:

- id,
- spreadsheet_id,
- enabled,
- polling interval metadata,
- last_seen_fingerprint,
- created_by / updated_by,
- timestamps.

RLS: Admin only.

### `v17_sync_batches`

Stores batch metadata and normalized snapshot payload/checksums.

RLS: Admin read only through explicit policies; writes through controlled RPC/Edge Function flow.

### `v17_sync_issues`

Stores row-level blockers/warnings:

- batch_id,
- entity type,
- source tab,
- source row,
- severity,
- code,
- message.

### Optional stable source identifiers

If the current `students` and teacher-directory structures do not already expose safe stable external keys, V17 adds a minimal mapping table rather than overloading names:

- `v17_student_source_keys(source_id, external_key, student_id)`
- `v17_teacher_source_keys(source_id, external_key, teacher/profile id)`

This mapping preserves existing production identities and avoids destructive rewrites.

## Server interfaces

### Edge Function `v17-google-sheet-sync`

Responsibilities:

- require a valid authenticated Supabase user,
- verify Admin authorization server-side,
- read Google API credentials from Edge Function secrets,
- read only the configured private spreadsheet,
- fetch the four bounded tabs,
- normalize values,
- compute a source fingerprint,
- submit normalized payload to a database RPC under an auditable actor identity,
- never expose Google private credentials to the client.

### RPC `v17_stage_sync_batch(...)`

- Admin-only execution path.
- Validates input envelope and source.
- Creates batch atomically.
- Rejects duplicate conflicting identities and malformed structural rows.

### RPC `v17_preview_sync(p_batch_id uuid)`

Returns:

- counts added/changed/deactivated,
- teacher blockers,
- student blockers,
- planning blockers/warnings,
- exact planning structural changes,
- whether the batch is eligible for TEST.

Read-only.

### RPC `v17_load_sync_to_test(p_batch_id uuid)`

- Admin only.
- Requires a validated current batch.
- Populates the existing V16 TEST planning layer from the batch.
- Does not alter attendance, grades, comments, or REAL teacher/student state.
- Produces a post-load preview.

### RPC `v17_apply_sync(p_batch_id uuid)`

One transactional Admin operation:

1. re-check batch freshness,
2. re-run authoritative validation,
3. apply teacher-directory changes,
4. apply student additions/deactivations/effective-dated group membership changes,
5. apply already-validated V16 TEST planning to REAL using the established V16 apply path,
6. record audit events,
7. mark batch `applied`.

Any blocker causes full rollback.

## Teacher identity rules

Google Sheets manages administrative teacher metadata and planning eligibility. It does not control Supabase Auth directly.

For an existing login-capable teacher:

- match via stable source `Code` mapping and verified email,
- require an existing authorized profile/Auth identity,
- never change authorization role merely because a spreadsheet cell says so.

For a new planning-only teacher:

- allow staging of the directory record,
- block assignment to REAL if the existing V16 planning model requires a profile identity that has not been provisioned.

Authentication/account provisioning remains an explicit Admin action outside sheet synchronization.

## Student behavior

V17 extends the existing V16 student-group history rather than replacing it.

Examples:

- New row `MAT123 / MPI1-A / G2 / 2026-09-14` -> create/match student and membership effective 2026-09-14.
- Same matricule changed later to G3 with `Date_effet=2026-10-01` -> close the previous membership and open G3 from 2026-10-01.
- `Actif=Non` with effective date -> end active membership from that date.

Already-recorded attendance, grades, and comments remain linked to historical session/student identities.

## Admin UI — V17 Sync Center

Add a new Admin-only section `Synchronisation V17`.

Displays:

- source status,
- last successful pull,
- last source fingerprint,
- current batch state,
- `Synchroniser maintenant`,
- teacher diff,
- student diff,
- planning diff,
- blockers/warnings,
- `Charger dans TEST`,
- link/navigation to existing V16 TEST planning editor,
- `Appliquer au REEL` only when every required check is green.

Example summary:

```text
Enseignants   +1  ~2  -0
Etudiants     +48 ~3  -1
Planning      4 changements
Bloquants     0
Avertissements 2
```

The HTML refreshes authoritative Supabase state after a successful apply. Normal application users never need Google API access.

## Excel fallback

The existing browser-side XLSX parser remains available as a fallback/manual-import path.

V17 should accept a normalized V17 workbook with the same four logical tables and route it through the same staging/validation pipeline as Google Sheets.

The six supplied legacy planning/attendance workbooks are reference inputs, not the long-term sync schema. A V17 conversion/import helper may extract their planning structure, but blank student-name rows are not treated as students.

## Failure handling

Examples of blocking errors:

- duplicate teacher code,
- duplicate student matricule,
- unknown class/group,
- unknown teacher code in planning,
- teacher without required authorized account mapping,
- room conflict,
- teacher time conflict,
- repeated manipulation for a class/group,
- invalid holiday/DS planning row,
- stale batch superseded by a newer source revision,
- invalid date/time,
- attempt to mutate completed/historical pedagogy through sync.

Errors are reported by source tab and row number when possible.

No partial REAL apply is allowed.

## Audit and observability

Every sync/apply records:

- authenticated admin actor,
- source id,
- batch id,
- source fingerprint,
- timestamps,
- counts by entity/change type,
- validation outcome,
- apply outcome.

Secrets and raw Google credentials are never logged.

## Realtime and refresh

After REAL apply:

- existing Supabase Realtime/authoritative refresh mechanisms update the HTML,
- student lists and session rosters use the existing V16 membership/session logic,
- planning views load the newly applied authoritative assignments,
- no browser-side Google polling is required.

## Testing strategy

### Unit/contract tests

- Google row normalization.
- Header/value/date/time parsing.
- teacher identity/diff matching.
- student matricule matching and effective-dated group changes.
- duplicate detection.
- planning normalization.
- staging state transitions.

### SQL tests

- Admin-only staging/apply.
- RLS on all new public tables.
- no anonymous/teacher mutation.
- atomic rollback on any blocker.
- student history preservation.
- teacher historical-session preservation.
- V16 planning validation reused, not bypassed.
- attendance/grade/comment counts unchanged by staging/TEST operations.

### Integration tests

- Sheet change -> staged batch -> preview.
- staged planning -> V16 TEST.
- validated batch -> REAL apply.
- stale source revision rejected.
- missing Google credentials produce safe error.
- final HTML contains no Google private key or service-role secret.

### Regression tests

All existing V16 tests for:

- official 32-session calendar,
- room guards,
- teacher weekly limits/distribution,
- manipulation history,
- TEST/REAL preview/apply,
- session start,
- presence rules,
- completed-session grade-only behavior,

must remain green.

## Rollout

1. Add V17 staging schema/RLS/RPCs without changing current UI behavior.
2. Add and test Google Edge Function using secrets.
3. Create the private native Google Sheet template.
4. Add V17 Admin Sync Center.
5. Test manual pull and staging with non-production data.
6. Verify V16 TEST loading.
7. Verify student/teacher diffs with synthetic rows.
8. Run full regression/security suite.
9. Produce V17 standalone HTML artifact.
10. Only after clean verification, enable the production Google source.

## Explicit exclusions from initial V17

- Google Sheet cannot directly edit attendance, grades, or comments.
- No automatic Auth-account creation from a spreadsheet row.
- No public/published Google Sheet.
- No automatic REAL apply.
- No destructive deletion of students/teachers with historical data.
- No change to V5.13 canonical rules.
- No mixing with the separate Nhost migration/application.

## Acceptance criteria

V17 is accepted when all of the following are true:

1. A private Google Sheet can add/change/deactivate teacher administrative rows.
2. A private Google Sheet can add/change/deactivate students with stable matricule identity and effective-dated group membership.
3. A private Google Sheet can change official planning rows.
4. A pull creates an auditable staging batch without modifying REAL.
5. Planning can be loaded into existing V16 TEST and passes authoritative validation.
6. Admin can preview all teacher/student/planning changes before REAL apply.
7. REAL apply is atomic and Admin-only.
8. Attendance, grades, comments, and historical sessions are never altered by staging or TEST sync.
9. Existing presence/grade closure rules remain unchanged.
10. Final standalone HTML contains no privileged Google or Supabase secret.
11. Existing V16 regression suite remains green.
12. Google changes become visible in the HTML only after the appropriate staged/apply workflow and authoritative refresh.
