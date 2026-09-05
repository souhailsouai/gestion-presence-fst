# V17 Google Sheets Synchronization Implementation Plan

> **For agentic workers:** implement this plan task-by-task with TDD. Prefer `superpowers:subagent-driven-development` for the current session or `superpowers:executing-plans` for inline/sequential execution. Do not deploy production changes until the relevant tests, full Web regression suite, security review, and V16 invariants are green.

**Goal:** Add V17 secure synchronization from one private Google Sheet (teachers, students, planning, parameters) into an auditable staging layer, load planning into the existing V16 TEST context, and allow one explicit Admin-only atomic apply to REAL without changing attendance/grade/comment semantics.

**Architecture:** Preserve V5.13 and V16 as the operational core. Add V17 staging tables and RPCs, a Supabase Edge Function that reads bounded Google Sheets ranges using server-side secrets, an Admin-only Web Sync Center, an Excel fallback that sends the same normalized payload, and a native Google Sheet template. Supabase remains the runtime source of truth; Google Sheets never writes directly to pedagogical tables.

**Tech Stack:** PostgreSQL/Supabase RLS + RPC, Supabase Edge Functions (Deno/TypeScript), Google Sheets API, HTML/CSS/JavaScript, Supabase JS, Node.js `node:test`, Python/OpenPyXL for the source workbook template, existing bundled SheetJS for browser `.xlsx` fallback, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-05-v17-google-sheets-sync-design.md`

## Global Constraints

- V5.13 remains immutable; V17 is additive.
- Preserve all V16 planning rules and all presence/grade/comment closure rules.
- Google Sheets and Excel may stage data only; neither may edit attendance, grades, comments, or completed-session history.
- REAL apply is explicit, Admin-only, MFA/mutation-gated where current critical V16 operations are gated, and transactional.
- Never expose `service_role`, Google private keys, cron secrets, or any privileged credential in Web HTML or Git.
- Private Google Sheet only; never publish it to the Web.
- The official 2026/2027 calendar remains 32 teaching sessions / 128 assignments unless a separately approved future calendar feature changes it.
- Existing V16 six-teacher rule stays authoritative. Extra teacher rows may exist in V17 directory/staging, but a planning row can reach REAL only when its teacher maps to a current authorized profile/constraint and the prospective V16 week still uses exactly six configured teachers.
- Student identity uses stable `Matricule`; never match by name alone.
- Migration filenames must be generated at implementation time with `supabase migration new <name>`. Do not invent timestamp prefixes. Contract tests locate migrations by suffix.

Use this helper pattern in SQL contract tests so generated migration timestamps remain deterministic to the tests:

```js
function migration(suffix){
  const name=fs.readdirSync('supabase/migrations').find(x=>x.endsWith(suffix));
  assert.ok(name,`${suffix} missing`);
  return fs.readFileSync(path.join('supabase/migrations',name),'utf8');
}
```

---

## Task 1: Fix V16 student family/group compatibility before importing students

**Files:**
- Modify: `web/v16-student-groups.js`
- Create migration with: `supabase migration new v17_student_family_compatibility`
- Test: `tests/web/v17-student-family-compat.test.cjs`

**Interfaces:**
- Replace `public.v16_students_for_session(uuid,text)` without changing its public signature.
- `V16StudentGroups` must recognize `MPI1-A-G1` as family `MPI1-A`.
- Current UI membership resolution must use the membership effective on the current date, not simply the latest future/ended row.

- [ ] **Step 1: Write the failing contract test.** Require SQL to strip `-G1..G4` from concrete class names and require the Web helper to support hyphenated group names.

```js
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
function migration(s){const n=fs.readdirSync('supabase/migrations').find(x=>x.endsWith(s));assert.ok(n);return fs.readFileSync(path.join('supabase/migrations',n),'utf8');}
test('session roster resolves concrete V16 group classes to session family',()=>{
  const sql=migration('_v17_student_family_compatibility.sql');
  assert.match(sql,/create or replace function public\.v16_students_for_session/i);
  assert.match(sql,/regexp_replace\s*\(\s*c\.name/i);
  assert.match(sql,/c\.group_number\s*=\s*m\.group_no/i);
});
test('student UI recognizes MPI1-A-G1 family and effective memberships',()=>{
  const src=fs.readFileSync('web/v16-student-groups.js','utf8');
  assert.match(src,/\[-\\s\]G\[1-4\]/i);
  assert.match(src,/effective_from/i);
  assert.match(src,/effective_to/i);
});
```

- [ ] **Step 2: Run RED.** `node --test tests/web/v17-student-family-compat.test.cjs` must fail because the migration does not yet exist and the current regex only strips a space before `G`.
- [ ] **Step 3: Generate the migration using the Supabase CLI** (`supabase --help`, `supabase migration --help`, then `supabase migration new v17_student_family_compatibility`). Replace `v16_students_for_session` so the class predicate is equivalent to:

```sql
regexp_replace(c.name,'[-[:space:]]G[1-4]$','','i') = s.class_name
and c.group_number = m.group_no
```

Keep the existing auth/teacher-access checks and return shape. Exclude soft-deleted students/classes.
- [ ] **Step 4: Update `web/v16-student-groups.js`.** Make `classFamily()` strip either `-G1` or ` G1`; make current membership choose rows satisfying `effective_from <= today` and `(effective_to is null or today < effective_to)`, with the legacy `student.class_id` fallback unchanged.
- [ ] **Step 5: Run dedicated tests and existing student-group/roster tests.** Require GREEN.
- [ ] **Step 6: Commit:** `fix: resolve V16 student class families for V17`.

---

## Task 2: Add V17 staging schema, stable source keys, and Admin-only RLS

**Files:**
- Create migration with: `supabase migration new v17_sync_staging`
- Test: `tests/web/v17-sync-schema-sql.test.cjs`

**Interfaces:**
- Tables: `v17_sync_sources`, `v17_sync_batches`, `v17_sync_teacher_rows`, `v17_sync_student_rows`, `v17_sync_planning_rows`, `v17_sync_issues`, `v17_teacher_directory`, `v17_student_source_keys`.
- Every table in `public` has RLS enabled and explicit Admin-only policies.

- [ ] **Step 1: Write RED schema tests** requiring the eight tables, RLS enablement, `private.is_admin()` predicates, anon revocation, foreign keys, source-local unique keys, and batch lifecycle constraints.
- [ ] **Step 2: Run** `node --test tests/web/v17-sync-schema-sql.test.cjs` and verify RED.
- [ ] **Step 3: Generate migration** `v17_sync_staging` with the CLI. Use these structural contracts:

```text
v17_sync_sources
  id uuid PK
  source_kind text CHECK google_sheets|local_excel
  spreadsheet_id text nullable
  enabled boolean default false
  poll_minutes int default 5 CHECK >=5
  last_seen_fingerprint text nullable
  created_by/updated_by uuid -> profiles
  created_at/updated_at timestamptz

v17_sync_batches
  id uuid PK, source_id uuid FK
  fingerprint text, trigger_mode manual|scheduled|excel
  state fetched|invalid|validated|loaded_to_test|applied|rejected|superseded
  parameters jsonb, fetched_at, created_by nullable, created_at, applied_at
  UNIQUE(source_id,fingerprint)

v17_sync_teacher_rows
  batch_id, source_row, code, last_name, first_name, email,
  active, can_login, comment
  UNIQUE(batch_id,code)

v17_sync_student_rows
  batch_id, source_row, matricule, last_name, first_name, email,
  class_name, group_no, active, effective_date
  UNIQUE(batch_id,matricule)

v17_sync_planning_rows
  batch_id, source_row, session_date, start_time, end_time,
  class_name, group_no, teacher_code, manipulation_code, room, active
  UNIQUE(batch_id,session_date,class_name,group_no)

v17_sync_issues
  batch_id, entity_type, source_tab, source_row, severity blocker|warning,
  code, message

v17_teacher_directory
  source_id, code, profile_id nullable, last_name, first_name, email,
  active, can_login, comment, updated_by, timestamps
  UNIQUE(source_id,code)

v17_student_source_keys
  source_id, external_key, student_id
  UNIQUE(source_id,external_key), UNIQUE(source_id,student_id)
```

- [ ] **Step 4: Apply RLS policy pattern.** `authenticated` can SELECT/MUTATE only when `private.is_admin()`; `anon` has no privileges. Do not use user-editable metadata for authorization.
- [ ] **Step 5: Run schema contract test and full Web SQL-contract subset.** Require GREEN.
- [ ] **Step 6: Commit:** `feat: add V17 synchronization staging schema`.

---

## Task 3: Implement authoritative staging, normalization validation, and preview RPCs

**Files:**
- Create migration with: `supabase migration new v17_sync_staging_rpcs`
- Test: `tests/web/v17-sync-preview-sql.test.cjs`

**Interfaces:**
- `public.v17_set_sync_source(p_source_kind text,p_spreadsheet_id text,p_enabled boolean,p_poll_minutes integer) -> jsonb`
- `public.v17_stage_sync_batch(p_source_id uuid,p_fingerprint text,p_trigger_mode text,p_parameters jsonb,p_teachers jsonb,p_students jsonb,p_planning jsonb) -> jsonb`
- `public.v17_preview_sync(p_batch_id uuid) -> jsonb`
- Private helpers: `private.v17_class_family(text)`, `private.v17_resolve_class(text,integer)`, `private.v17_validate_batch(uuid)`.

- [ ] **Step 1: Write RED tests** requiring Admin authorization, batch freshness, source row capture, duplicate-code/matricule checks, class/group resolution, teacher-code reference checks, 2026/2027 official-calendar checks, M1–M6, rooms A–D, canonical time, and result counters.
- [ ] **Step 2: Run** `node --test tests/web/v17-sync-preview-sql.test.cjs` and verify RED.
- [ ] **Step 3: Generate migration and implement source configuration.** `v17_set_sync_source` must never store credentials; only spreadsheet id, enabled state, and poll metadata.
- [ ] **Step 4: Implement staging.** Lock the source with an advisory transaction lock. If the same fingerprint already exists, return that batch id idempotently. Mark an older non-applied batch `superseded` when a newer fingerprint is accepted. Insert normalized row tables in one transaction.
- [ ] **Step 5: Implement server validation.** Populate `v17_sync_issues`; set state `invalid` when blockers exist, else `validated`. Required blockers include duplicate identity, invalid class/group, invalid date/time, non-teaching/DS/holiday planning row, unknown teacher code, unlinked planning teacher, invalid manipulation/room, source mismatch, and attempt to alter a session already started/completed.
- [ ] **Step 6: Preserve V16 teacher semantics.** Preview must report a blocker if prospective planning references a profile outside the current configured six or if the V16 prospective week would violate the exact-six/2-days/day-distribution rules. Do not enlarge the V16 teacher pool implicitly.
- [ ] **Step 7: Implement preview output:**

```json
{
  "ok": true,
  "batch_id": "...",
  "state": "validated",
  "teachers": {"added":0,"changed":0,"deactivated":0},
  "students": {"added":0,"changed":0,"deactivated":0},
  "planning": {"changed":0,"active_rows":128},
  "blockers": [],
  "warnings": [],
  "eligible_for_test": true
}
```

- [ ] **Step 8: Run dedicated tests and relevant V16 planning SQL tests.** Require GREEN.
- [ ] **Step 9: Commit:** `feat: stage and preview V17 synchronization batches`.

---

## Task 4: Add safe teacher-directory reconciliation without Auth account creation

**Files:**
- Create migration with: `supabase migration new v17_teacher_reconciliation`
- Test: `tests/web/v17-teacher-reconciliation-sql.test.cjs`

**Interfaces:**
- Private helper `private.v17_apply_teacher_changes(p_batch_id uuid,p_actor uuid) -> jsonb`.
- Directory rows may be linked to existing `profiles`; the helper never inserts into Auth and never promotes roles.

- [ ] **Step 1: Write RED tests** requiring stable `Code`, exact unique case-insensitive email linking, no `auth.users` insert/update, no role elevation, no deletion of historical teacher/profile records, and a blocker for planning rows whose code has no valid linked profile.
- [ ] **Step 2: Run the test and verify RED.**
- [ ] **Step 3: Generate migration and implement reconciliation.** For each teacher row, upsert `v17_teacher_directory`. If `profile_id` is null and exactly one active `profiles.email` matches normalized email, link that profile. Never link by name alone.
- [ ] **Step 4: Treat `Actif=Non` as future directory/planning ineligibility only.** Do not soft-delete the linked profile and do not rewrite historical sessions/assignments.
- [ ] **Step 5: Keep V16 constraint ownership explicit.** A newly listed teacher with no existing valid `v515_teacher_constraints` row is visible in the V17 directory but cannot be used by a REAL-bound planning row. The Admin must provision/authenticate/configure that teacher through the existing Admin flow before it becomes eligible.
- [ ] **Step 6: Run dedicated + V16 teacher-policy tests.** Require GREEN.
- [ ] **Step 7: Commit:** `feat: reconcile V17 teacher directory safely`.

---

## Task 5: Add matricule-based student reconciliation and effective-dated memberships

**Files:**
- Create migration with: `supabase migration new v17_student_reconciliation`
- Test: `tests/web/v17-student-reconciliation-sql.test.cjs`

**Interfaces:**
- Private helper `private.v17_apply_student_changes(p_batch_id uuid,p_actor uuid) -> jsonb`.
- Reuse `v16_student_group_memberships` interval semantics.

- [ ] **Step 1: Write RED tests** for stable matricule mapping, new-student creation, group change, deactivation, no name-only matching, no destructive deletion, and unchanged attendance/grade/comment tables.
- [ ] **Step 2: Run the test and verify RED.**
- [ ] **Step 3: Generate migration.** Resolve concrete target class through class family + `group_number`. For a new matricule, create `students` with target `class_id`, use the target class's existing `teacher_id` as the legacy ownership column, then insert `v17_student_source_keys`.
- [ ] **Step 4: Create/change membership.** Implement the same interval behavior as `v16_set_student_group`: close a prior overlapping row at `Date_effet`; insert/update the new group membership; preserve exclusion constraint safety under an advisory lock. For a currently-effective change, also update `students.class_id` so legacy UI remains aligned.
- [ ] **Step 5: Deactivate without deleting.** `Actif=Non` ends the applicable membership on `Date_effet`; keep `students.deleted_at` null and keep all historic attendance/grades/comments.
- [ ] **Step 6: Update basic student metadata only for the mapped matricule.** Normalize name/email; never merge two students because their names match.
- [ ] **Step 7: Run dedicated tests plus Task 1 roster compatibility test.** Require GREEN.
- [ ] **Step 8: Commit:** `feat: reconcile V17 students by matricule`.

---

## Task 6: Load V17 planning into V16 TEST and apply the entire batch atomically to REAL

**Files:**
- Create migration with: `supabase migration new v17_sync_apply`
- Test: `tests/web/v17-sync-apply-sql.test.cjs`

**Interfaces:**
- `public.v17_load_sync_to_test(p_batch_id uuid) -> jsonb`
- `public.v17_apply_sync(p_batch_id uuid) -> jsonb`

- [ ] **Step 1: Write RED tests** requiring calls/reuse of `v16_clone_real_to_test`, `v16_save_test_week_plan`, `v16_preview_test_apply`, `v16_apply_test_teacher_plan`; freshness checks; batch locking; state transitions; and rollback when a nested result has `ok=false`.
- [ ] **Step 2: Run and verify RED.**
- [ ] **Step 3: Generate migration and implement `v17_load_sync_to_test`.** Require Admin + validated/current batch. Compute `effective_date = min(active planning session_date)`. Clone REAL→TEST at that date. Resolve each source `(date,class,group)` to one test session, `teacher_code` to linked authorized profile, and create the exact row shape required by `v16_save_test_week_plan`.
- [ ] **Step 4: Save complete affected weeks.** Group rows by ISO Monday. For each affected week, include all four assignments for every teaching session in that week; if the sheet omits an unchanged row, merge from cloned TEST so the existing complete-week RPC contract remains satisfied. Call `v16_save_test_week_plan` per week and abort on any failure.
- [ ] **Step 5: Call `v16_preview_test_apply(effective_date)`.** Only set batch `loaded_to_test` if preview is `ok=true` and blockers are empty.
- [ ] **Step 6: Implement `v17_apply_sync`.** Require Admin, `private.mutation_allowed()`, `loaded_to_test`, latest source fingerprint, and advisory lock. In the same PostgreSQL transaction:
  1. revalidate batch,
  2. apply teacher directory reconciliation,
  3. apply student reconciliation,
  4. call `v16_preview_test_apply`,
  5. call `v16_apply_test_teacher_plan`,
  6. raise on any `ok=false` result,
  7. audit and mark batch `applied`.
- [ ] **Step 7: Add invariant assertions in tests** proving staging/TEST operations do not change `attendance`, grades/comments inside attendance rows, `attendance_sheets`, or completed-session data.
- [ ] **Step 8: Run dedicated test and all V16 TEST/REAL tests.** Require GREEN.
- [ ] **Step 9: Commit:** `feat: apply V17 batches through V16 TEST atomically`.

---

## Task 7: Implement pure Google Sheet row normalization and fingerprinting

**Files:**
- Create: `supabase/functions/_shared/v17-sheet-normalize.ts`
- Test: `tests/web/v17-sheet-normalize.test.cjs`
- Fixture: `tests/fixtures/v17-sheet-values.json`

**Interfaces:**
- `normalizeWorkbook(input) -> {parameters,teachers,students,planning}`
- `fingerprintNormalized(value) -> Promise<string>`
- Exact bounded source ranges: `Enseignants!A1:G`, `Etudiants!A1:H`, `Planning!A1:I`, `Parametres!A1:B`.

- [ ] **Step 1: Write a Node-testable fixture** containing accented names, empty student rows, `Oui/Non`, `G1..G4`, M1–M6, rooms A–D, ISO dates and `DD/MM/YYYY` dates.
- [ ] **Step 2: Write RED tests** requiring exact headers, trimming/control-character sanitation, case normalization, canonical `YYYY-MM-DD` and `HH:MM`, omission of completely blank student rows, row-number preservation, duplicate detection handoff, and stable SHA-256 output for identical normalized values.
- [ ] **Step 3: Run the test and verify RED.**
- [ ] **Step 4: Implement pure normalization** with no database/network calls. Keep source row numbers. Reject malformed required headers rather than guessing columns.
- [ ] **Step 5: Hash canonical JSON** after stable key ordering; do not include access tokens or credentials in the fingerprint input.
- [ ] **Step 6: Run normalization tests and TypeScript syntax/type checks available in the project environment.** Require GREEN.
- [ ] **Step 7: Commit:** `feat: normalize V17 Google Sheet payloads`.

---

## Task 8: Add the secure Google Sheets Edge Function and 5-minute staging schedule

**Files:**
- Create: `supabase/functions/v17-google-sheet-sync/index.ts`
- Create: `supabase/functions/_shared/v17-google-auth.ts`
- Create migration with: `supabase migration new v17_google_sync_schedule`
- Test: `tests/web/v17-edge-function-contract.test.cjs`

**Interfaces:**
- Manual HTTP invocation: authenticated Admin bearer token.
- Scheduled invocation: secret-protected server request.
- Secrets: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, `V17_CRON_SECRET`, standard Supabase function environment (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).

- [ ] **Step 1: Before coding, read the current Supabase changelog and current Edge Function/Cron/Vault docs plus current Google service-account JWT/Sheets API docs.** Use the documented 2026 API shapes; do not rely on remembered CLI/API syntax.
- [ ] **Step 2: Write RED contract tests** requiring bounded ranges, no credential literal, no browser-exposed service-role key, Admin verification for manual mode, cron-secret verification for scheduled mode, no raw Sheet values in logs, and call to V17 staging RPC.
- [ ] **Step 3: Implement Google service-account auth** server-side with WebCrypto/JWT using the current documented token endpoint and scope `https://www.googleapis.com/auth/spreadsheets.readonly`.
- [ ] **Step 4: Implement the Edge Function.** Manual mode validates the caller token/profile is Admin and stages under that actor. Scheduled mode validates `V17_CRON_SECRET`, uses service-role only inside the function, derives audit actor/source ownership from the configured V17 source, and stages only; it never calls REAL apply.
- [ ] **Step 5: Fetch exactly the four bounded ranges**, normalize with Task 7, compute fingerprint, and call `v17_stage_sync_batch`. Return `{ok,batch_id,state,fingerprint,preview}` without returning Google tokens.
- [ ] **Step 6: Generate schedule migration** only after reading current Supabase Cron docs. Configure an every-5-minute call to the Edge Function through the supported Cron/HTTP/Vault mechanism. The source `enabled` flag must be checked so scheduling does nothing when disabled.
- [ ] **Step 7: Run contract tests.** Require GREEN.
- [ ] **Step 8: Commit:** `feat: add secure V17 Google Sheets pull function`.

---

## Task 9: Add Web V17 API client and Admin Synchronization Center

**Files:**
- Create: `web/v17-sync-api.js`
- Create: `web/v17-sync-center.js`
- Modify: `web/online-fixes.js`
- Test: `tests/web/v17-sync-api.test.cjs`
- Test: `tests/web/v17-sync-center.test.cjs`

**Interfaces:**
- `V17SyncApi.source()`, `syncNow()`, `preview(batchId)`, `loadToTest(batchId)`, `apply(batchId)`.
- `V17SyncCenter.mount()` renders only when `V16ActiveRole.canUseAdminControls()===true`.

- [ ] **Step 1: Write RED API tests** using a fake Supabase client. Require `functions.invoke('v17-google-sheet-sync')`, RPC names, error normalization, and no privileged credential arguments.
- [ ] **Step 2: Write RED UI tests** requiring zero rendered controls in teacher mode and these Admin controls/statuses: source id/status, last sync, `Synchroniser maintenant`, teacher/student/planning diff counters, blockers/warnings, `Charger dans TEST`, `Appliquer au RÉEL` disabled until eligible.
- [ ] **Step 3: Implement `v17-sync-api.js`** as a small UMD module similar to existing V16 modules; all writes go through Edge Function/RPC interfaces.
- [ ] **Step 4: Implement `v17-sync-center.js`.** Mount beside the V16 TEST/planning controls, not as a replacement for them. After `loadToTest`, switch/refresh V16 planning in TEST. After REAL apply call `FSTOnlineRuntime.refreshAuthoritativeState()` and `V16PlanningUI.init(...)`.
- [ ] **Step 5: Update `online-fixes.js`** to mount/unmount the Sync Center on login, role change, and Planning-tab activation.
- [ ] **Step 6: Run dedicated UI/API tests and V16 active-role/test-mode tests.** Require GREEN.
- [ ] **Step 7: Commit:** `feat: add V17 admin synchronization center`.

---

## Task 10: Add normalized local Excel fallback through the same staging pipeline

**Files:**
- Create: `web/v17-excel-import.js`
- Modify: `web/v17-sync-center.js`
- Test: `tests/web/v17-excel-import.test.cjs`
- Fixture: `tests/fixtures/v17-sync-template.xlsx`

**Interfaces:**
- `V17ExcelImport.parse(arrayBuffer) -> {parameters,teachers,students,planning}`
- `V17ExcelImport.stage(file,api) -> Promise<batch>`.

- [ ] **Step 1: Write RED tests** using a real `.xlsx` fixture with four tabs and accented names. Require ArrayBuffer parsing through existing bundled `XLSX`; blank student rows must be ignored.
- [ ] **Step 2: Require exact tab/header names** and the same semantic values as Google Sheet normalization; unknown class/group/manip/room values remain server-side blockers, not silently remapped.
- [ ] **Step 3: Implement parse/stage.** Compute a local file fingerprint in browser, call `v17_stage_sync_batch` through the authenticated client with a `local_excel` source, then show the same preview UI used by Google batches.
- [ ] **Step 4: Add `Importer Excel V17` to Admin Sync Center.** Do not restore the legacy direct-to-`students/classes` import path for V17 files.
- [ ] **Step 5: Run dedicated tests.** Require GREEN.
- [ ] **Step 6: Commit:** `feat: add V17 Excel staging fallback`.

---

## Task 11: Build the canonical V17 workbook and import it as a private native Google Sheet

**Files:**
- Create: `scripts/build_v17_google_sheet_template.py`
- Create: `releases/v17/V17-Google-Sheets-2026-2027.xlsx`
- Test: `tests/web/v17-sheet-template.test.cjs`

**Interfaces:**
- Four tabs exactly: `Enseignants`, `Etudiants`, `Planning`, `Parametres`.
- Output workbook is the import source for the native Google Sheet; the local `.xlsx` is not the runtime source.

- [ ] **Step 1: Invoke the spreadsheet skill and read its verification/style requirements before creating the workbook.**
- [ ] **Step 2: Write RED structural test** using OpenPyXL/ZIP inspection or a Node XLSX reader to assert tab/header names, 6 seeded teacher codes, blank student data rows, 128 active planning assignment rows, and parameters for `2026/2027`, semester `1`, `Africa/Tunis`.
- [ ] **Step 3: Implement the Python builder.** Use OpenPyXL. Seed stable teacher codes `ENS001..ENS006` mapped to the six current V16 teachers. Planning is generated from the authoritative V16 2026/2027 REAL snapshot, not hand-transcribed. `Etudiants` contains headers plus formatted empty input rows because the supplied attendance files contain no student names.
- [ ] **Step 4: Add spreadsheet validations/formatting:** dropdowns for Oui/Non, G1–G4, M1–M6, A–D; date/time formats; freeze headers; filters; readable widths; input cells distinguished from linked/static values.
- [ ] **Step 5: Recalculate/render/verify the workbook according to the spreadsheet skill.** Confirm no formula errors and all four tabs are visually usable.
- [ ] **Step 6: Import the verified `.xlsx` into Google Drive as `native_google_sheets`** in the `ChatGPT` folder. Verify the created file id differs from every uploaded source workbook and remains private.
- [ ] **Step 7: Record the native spreadsheet id through `v17_set_sync_source(... enabled=false ...)`.** Keep background sync disabled until Task 13 verification.
- [ ] **Step 8: Share only as required for operation** (user + service-account email). Do not publish by link/public Web.
- [ ] **Step 9: Commit template builder/output/test:** `feat: add canonical V17 Google Sheets template`.

---

## Task 12: Integrate V17 modules into online/standalone builds and CI

**Files:**
- Modify: `scripts/build_online_web.py`
- Modify: `scripts/build_single_file_release.py`
- Modify: `.github/workflows/build-web.yml`
- Create: `tests/web/v17-release-contract.test.cjs`
- Keep: existing `tests/web/v16-release-contract.test.cjs` as regression coverage.

**Interfaces:**
- Online build loads `v17-sync-api.js`, `v17-excel-import.js`, `v17-sync-center.js` after V16 role/test/planning dependencies and SheetJS where required.
- Standalone build inlines the modules with `data-fst-v17-*="inline"` markers.
- Artifact name: `Gestion-Presence-FST-Web-V17-candidate`.

- [ ] **Step 1: Write RED release tests** requiring `data-app-version="V17"`, all V17 script tags in online build, all V17 inline markers in standalone build, preserved V16 modules, preserved `save_attendance_sheet`/`grade_only`, and absence of Google private keys/service-role strings.
- [ ] **Step 2: Run V17 release test and verify RED.**
- [ ] **Step 3: Update online build module list/order** without removing any approved V16 functional module.
- [ ] **Step 4: Update standalone inliner** to remove external V17 tags and inline source once, with assertions that no V17 external tag remains.
- [ ] **Step 5: Update GitHub Actions:** syntax-check `web/v17-*.js`; include `supabase/functions/**`, `releases/v17/**`; verify V17 markers; package final HTML as `Gestion-Presence-FST-Web-2026-2027.html`; upload `Gestion-Presence-FST-Web-V17-candidate`.
- [ ] **Step 6: Run every `tests/web/*.test.cjs`, build online, build standalone, verify SHA-256.** Require GREEN.
- [ ] **Step 7: Commit:** `release: integrate V17 synchronization into Web build`.

---

## Task 13: Production deployment, guarded activation, and final verification

**Files/Systems:**
- Production Supabase project: `dbslzmvzbxczpqyektpx`
- GitHub PR from the V17 implementation branch to `main`
- Google Sheet created in Task 11
- Final artifact under `dist/web` / GitHub Actions

**Interfaces:** production DB migrations, Edge Function, secrets, disabled/enabled V17 source, CI artifact.

- [ ] **Step 1: Invoke `verification-before-completion` before any completion claim.** Also re-read current Supabase changelog/docs immediately before deployment.
- [ ] **Step 2: Run fresh pre-deploy invariants in production:** official teaching sessions = 32; assignments = 128; room conflicts = 0; current `v16_preview_test_apply('2026-09-14')` has `structural_changes=0`; record attendance/grade/comment/sheet counts for before/after comparison.
- [ ] **Step 3: Deploy additive migrations in order** and run Supabase database/security advisors. Fix any RLS/function privilege issue before proceeding.
- [ ] **Step 4: Deploy `v17-google-sheet-sync` Edge Function.** Set secrets through the supported Supabase secret mechanism; never commit them.
- [ ] **Step 5: Keep V17 source `enabled=false`.** Run a manual Google pull; verify it produces only a staging batch and no REAL or pedagogical mutation.
- [ ] **Step 6: Run a TEST load.** Verify V16 TEST planning passes all weeks, V16 preview is clean, and staging/TEST did not change attendance/grades/comments/sheets.
- [ ] **Step 7: Verify student path using controlled staged rows** before real roster import: one synthetic/mapped test case must prove `MPI1-A-Gn` membership appears in the `MPI1-A` session roster. Remove/revert synthetic data inside the test transaction or use non-production test rows that are not applied to REAL.
- [ ] **Step 8: Verify teacher path.** Current six teachers remain the configured pool. An unlinked seventh teacher row must stage successfully but block a REAL planning reference.
- [ ] **Step 9: Apply a no-op/current planning batch to REAL only when preview is clean.** Confirm 32 sessions/128 assignments remain, room conflicts 0, and post-apply V16 preview returns `structural_changes=0`.
- [ ] **Step 10: Recheck pedagogical invariants.** Counts/content of pre-existing attendance, grades, comments, completed sessions and attendance sheets must be identical except for explicitly created legitimate student-directory/membership records in the tested batch.
- [ ] **Step 11: Enable 5-minute staging sync only after manual verification.** Wait for one scheduled execution and verify it creates/refreshes staging only; REAL remains unchanged without Admin apply.
- [ ] **Step 12: Open PR, require green CI, review changed-file security surfaces, then merge.** Do not merge with a failing V16 regression.
- [ ] **Step 13: Fetch the final CI artifact, compute/verify SHA-256, and deliver:**
  - final standalone V17 HTML,
  - V17 ZIP/artifact if produced,
  - private native Google Sheet link,
  - concise deployment/verification summary.

**Final acceptance evidence must explicitly include:**

```text
V17 build/CI: PASS
V16 regression suite: PASS
Official sessions: 32
Official assignments: 128
Room conflicts: 0
TEST -> REAL preview structural_changes: 0 after no-op synchronization
Google scheduled sync: staging only
Privileged secrets in HTML: 0
Attendance/grade/comment unintended mutations: 0
Student roster family mapping: PASS
Six-teacher V16 planning policy: PASS
```

---

## Self-review checklist before execution

- Every V17 write path is Admin-only or server-secret-only and is validated again server-side.
- No public `SECURITY DEFINER` shortcut is introduced to bypass RLS; if privileged code is unavoidable, keep it private/non-exposed and tightly revoke/grant execution according to current Supabase guidance.
- Every migration is additive and generated with the CLI.
- Google Sheets cannot auto-apply REAL.
- `Matricule` is the only source identity for student synchronization.
- Teacher codes never grant Auth or Admin role.
- The existing V16 six-teacher rule remains intact.
- The discovered `MPI1-A` versus `MPI1-A-G1` roster mismatch is fixed before student synchronization is enabled.
- The existing completed-session `grade_only` fix remains covered by regression tests.
- The final standalone HTML contains no secret and remains online-only.
