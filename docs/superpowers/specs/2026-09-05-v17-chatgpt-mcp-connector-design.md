# V17 ChatGPT MCP Connector Design

## Goal

Provide a direct, secure connector between ChatGPT and the App présence V17 ecosystem so ChatGPT can inspect and operate the authorized Google Sheets and V17 TEST workflows without requiring the user to manually copy Apps Script code for routine operations.

## Scope

The connector covers only the independent App présence project and must not modify unrelated applications or repositories.

In scope:
- read the Google Sheets in `Gestion-presence_TP_Prepa`;
- inspect and synchronize the existing teacher selection list;
- inspect and validate the teacher/manipulation assignment sheet;
- inspect the three attendance workbooks and their 24 student-group tabs;
- add, update and request permanent deletion of students through the V17 staging flow;
- inspect the three official planning workbooks;
- stage synchronized data into V17 TEST;
- preview V17 validation results and blockers;
- perform guarded Admin-authorized writes only through server-side controls.

Out of scope:
- creating, deleting or modifying Supabase teacher Auth accounts from Google Sheets;
- changing V5.13 business rules;
- writing attendance, grades or comments from Google Sheets;
- automatic TEST-to-REAL application;
- exposing Google credentials, Supabase service-role secrets or privileged tokens to ChatGPT or browser code.

## Architecture

Primary flow:

`ChatGPT custom MCP app -> V17 MCP server -> Supabase Auth/OAuth + authorization -> V17 server operations -> Google Sheets / Supabase V17 TEST`

The MCP server is the only ChatGPT-facing integration endpoint. It exposes narrowly scoped tools and never returns privileged credentials.

Google Sheets remains an administrative source. Supabase remains authoritative for the application. V16/V17 TEST validation remains the required gate before any REAL planning change.

Apps Script remains useful for native spreadsheet behavior such as on-edit bookkeeping and menu actions, but the ChatGPT connector does not depend on manual Apps Script interaction for routine reads and synchronization.

## Authentication and authorization

Use Supabase Auth as the OAuth 2.1 identity provider for the MCP app. The MCP server validates the authenticated user and maps that identity to the existing `profiles` role model.

Authorization rules:
- Admin: may read all configured V17 sources, stage changes, manage student import/delete requests, validate assignments and load validated batches to TEST.
- Teacher: read-only access only where existing application rules allow it; no connector-based administrative writes.
- No unauthenticated write tools.
- No role elevation from MCP.

All privileged operations are rechecked server-side even if ChatGPT already authenticated the user.

## MCP tools

### Discovery and status

`v17_list_sources()`
- returns the configured Sheets, source type, status and last successful sync.

`v17_get_sync_status()`
- returns latest batch state, fingerprint, validation state and blockers.

### Teachers

`v17_list_teachers()`
- returns only the existing authorized teacher selection list.

`v17_sync_teacher_selection()`
- refreshes the hidden `Enseignants_Source` list used by the assignment workbook.
- never creates/deletes/changes Supabase Auth accounts.

### Teacher/manipulation assignment

`v17_get_manipulation_assignments()`
- reads M1-M6, room, teacher 1 and teacher 2.

`v17_validate_manipulation_assignments()`
- verifies all six manipulations exist;
- exactly two distinct teachers per manipulation;
- each of the six configured teachers has exactly two manipulations;
- every referenced teacher exists in the teacher selection source.

`v17_update_manipulation_assignment(manipulation, teacher1, teacher2)`
- Admin-only;
- updates only the specified row after validation;
- does not change Supabase teacher accounts.

### Students

`v17_list_students(class_name?, group_no?)`
- reads normalized students from all 24 group tabs.

`v17_upsert_student(source, sheet, row, name, student_id?)`
- Admin-only;
- assigns/keeps a stable V17 ID;
- stages the change before Supabase reconciliation.

`v17_delete_student_permanently(student_id, source_context)`
- Admin-only;
- permanent deletion is explicit;
- executes only through a transactional server-side RPC;
- deletes or cascades only the student-owned data explicitly defined by the V17 deletion policy;
- must reject deletion if a protected reference cannot be safely removed;
- audit entry required.

The visible student workbook layout remains unchanged. Hidden technical columns `V17_STATUT` and `V17_ID` continue to support stable identity and deletion requests.

### Planning

`v17_get_planning(day_or_source)`
- reads the official Monday, Thursday and Friday planning sources.

`v17_stage_planning_sync()`
- normalizes Sheet values;
- creates a V17 sync batch;
- validates against V16 rules;
- never applies REAL automatically.

### TEST workflow

`v17_preview_sync(batch_id)`
- returns normalized diff, blockers and warnings.

`v17_load_sync_to_test(batch_id)`
- Admin-only;
- loads only the latest validated non-superseded batch into V16 TEST.

`v17_apply_test_to_real(batch_id)`
- Admin-only;
- requires explicit invocation;
- reruns all validations and transactionally applies through the existing V16 TEST-to-REAL path;
- never invoked automatically by scheduled sync or spreadsheet edits.

## Google Sheets integration

Configured sources:
- `Enseignants`;
- `Affectation enseignants par manipulation - TP Physique 2026-2027`;
- three `PLANNING_*` Sheets;
- three `Cahier_Presence_*` Sheets.

All configured Sheets must remain private and owned by `souhail.souai@fst.utm.tn` unless the Admin explicitly changes the source configuration later.

The connector stores source IDs server-side and checks expected titles/tabs before writing.

All source spreadsheets use `Africa/Tunis`.

## Server-side Google access

Preferred implementation:
- Google OAuth credentials or service-account-equivalent credentials are stored only in Supabase secrets/server configuration;
- MCP tools call server-side Google APIs;
- no Google refresh token, client secret or private key is returned to ChatGPT;
- Apps Script is not treated as a security boundary.

If Workspace policy prevents service credentials from accessing the user-owned private Sheets, use delegated user OAuth with encrypted server-side refresh-token storage. The user authorizes once; subsequent connector operations remain direct from ChatGPT.

## V17 data flow

1. ChatGPT calls an MCP tool.
2. MCP server validates the Supabase OAuth access token.
3. MCP server resolves application role and permissions.
4. MCP server reads/writes the authorized Google Sheet or calls a V17 RPC.
5. Changes are normalized into a V17 batch when synchronization is involved.
6. V17 validation runs server-side.
7. TEST receives validated structural changes only after explicit Admin action.
8. REAL receives changes only through explicit Admin apply and V16 verification.
9. Audit trail records actor, source, action, batch and result.

## Permanent student deletion policy

The user has explicitly requested permanent deletion support.

The deletion operation must be implemented as a dedicated Admin RPC, not by arbitrary client-side DELETE queries.

The RPC must:
- require Admin authorization;
- identify the student by stable V17/Supabase mapping, never by name alone;
- lock or otherwise protect the target during the transaction;
- enumerate dependent attendance/grade/comment/group-membership records;
- remove dependencies only according to the approved deletion policy;
- delete the student row last;
- write an audit record containing the actor, student ID, source context and dependency counts;
- rollback the entire transaction on any error.

No bulk deletion is exposed initially.

## Safety

- No `service_role` in HTML, Apps Script or ChatGPT-visible tool output.
- No Google credential in HTML or Apps Script.
- OAuth bearer tokens are accepted only over HTTPS.
- MCP write tools are Admin-only.
- Every write tool validates exact resource IDs/tabs and rejects unknown sources.
- Spreadsheet-originated changes cannot bypass V16 planning rules.
- Scheduled sync may stage only; it never applies REAL.
- Attendance, grades and comments are never modified by planning/teacher sync.

## Error handling

Return structured MCP errors with a stable code and a concise French message.

Examples:
- `UNAUTHORIZED`: `Authentification requise.`
- `FORBIDDEN`: `Action réservée à l'administrateur.`
- `SOURCE_MISMATCH`: `Le fichier Google Sheets ne correspond pas à la source V17 configurée.`
- `TEACHER_RULE_INVALID`: `Chaque enseignant doit être affecté à exactement 2 manipulations.`
- `STUDENT_NOT_FOUND`: `Étudiant introuvable.`
- `DELETE_BLOCKED`: `Suppression définitive impossible à cause de références protégées.`
- `BATCH_SUPERSEDED`: `Ce lot de synchronisation n'est plus le lot courant.`
- `V16_VALIDATION_FAILED`: `La validation V16 a détecté des conflits.`

## Audit

Every write stores:
- authenticated user ID;
- application role;
- MCP tool name;
- source resource ID;
- batch ID if applicable;
- before/after summary for structural changes;
- timestamp in UTC;
- result status.

Google-specific audit stores only resource IDs and normalized change metadata, never credentials.

## Deployment

Deploy the MCP server as a dedicated V17 server component behind HTTPS. It may be implemented with a Supabase Edge Function if protocol/runtime requirements are satisfied; otherwise deploy a minimal external MCP server that still uses Supabase Auth and V17 RPCs.

The server URL is then registered once as a custom ChatGPT app in the workspace developer/app settings.

This one-time ChatGPT workspace registration is the only administrative step that cannot be performed by the connector itself.

## Testing

Mandatory tests:
- OAuth token required for every MCP call;
- teacher read tool returns exactly the configured six teachers;
- teacher sync cannot create/update/delete Auth users;
- manipulation validation rejects missing/duplicate teachers and non-2 counts;
- all 24 student group tabs are recognized;
- stable student IDs survive name edits;
- permanent deletion rejects name-only addressing;
- permanent deletion is transactional and audited;
- planning sync stages only;
- TEST load reuses V16 validation;
- REAL apply is impossible without explicit Admin tool invocation;
- no privileged secret appears in tool output;
- existing V16 regression suite remains green.

## Acceptance criteria

The connector is accepted when:
- ChatGPT can directly read the configured Google Sheets through MCP;
- ChatGPT can directly update authorized teacher/manipulation and student data through scoped tools;
- teacher Supabase accounts remain untouched by Sheets operations;
- permanent student deletion is available to Admin through a dedicated transactional path;
- sync reaches V17 TEST without manual Apps Script copy/paste;
- no automatic REAL apply exists;
- all V16 business-rule tests and V17 connector tests pass;
- all privileged secrets remain server-side.
