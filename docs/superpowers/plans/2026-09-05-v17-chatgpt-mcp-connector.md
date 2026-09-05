# V17 ChatGPT MCP Connector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a direct, authenticated ChatGPT MCP connector for App présence V17 that can read and safely operate the eight authorized Google Sheets, stage planning/student changes, support explicit permanent student deletion, and reuse V16 TEST→REAL validation without exposing privileged credentials.

**Architecture:** Run a remote MCP server in a dedicated Supabase Edge Function using `mcp-lite` and Supabase Auth OAuth 2.1. The Edge Function accesses Google Sheets through a server-side Google service account shared on the private `Gestion-presence_TP_Prepa` folder, validates every source against an allowlist, and calls V17/V16 RPCs using the authenticated user's bearer token so RLS and `private.is_admin()` remain authoritative. Apps Script remains only for native Sheet behavior (`V17_ID`, `V17_STATUT`, local validation); routine ChatGPT reads/writes do not depend on Apps Script web endpoints or client-side secrets.

**Tech Stack:** Supabase PostgreSQL/RLS/RPC, Supabase Auth OAuth 2.1, Supabase Edge Functions (Deno 2), `mcp-lite@0.8.2`, Hono 4, Zod 4, `@supabase/server`, Google Sheets API v4, Google Drive API v3, Apps Script, Node.js `node:test`, Deno tests, existing V16 Web build/CI.

**Spec:** `docs/superpowers/specs/2026-09-05-v17-chatgpt-mcp-connector-design.md`

## Global Constraints

- V5.13 remains immutable; V17 is additive.
- V16 planning/business rules remain authoritative, including the exact-six teacher policy and TEST→REAL validation.
- No Google Sheet operation creates, modifies, deletes, or elevates a Supabase teacher Auth account.
- The visible teacher source is only the six existing teacher names; every name must resolve to one current configured `v515_teacher_constraints` profile before it can be used.
- `Affectation enseignants par manipulation - TP Physique 2026-2027` defines allowed teacher pairs per manipulation; it does not automatically rewrite per-session teacher assignments.
- Planning import changes only session/class/group/manipulation/room structure in TEST and initially preserves the current V16 `teacher_id`; a teacher/manipulation mismatch is a blocker until Admin fixes TEST.
- Permanent student deletion is explicit, Admin-only, addressed by stable `V17_ID`/Supabase ID, transactional in PostgreSQL, audited, and never inferred from a name match.
- A permanent deletion removes the student's dependent `attendance` rows (which contain presence/grade/comment values), group memberships, V17 source mappings, then the student row. This is the only V17 workflow allowed to remove historical pedagogical rows, because the user explicitly requested permanent deletion.
- A deletion tombstone prevents a stale Google row from recreating a deleted student if Sheet cleanup fails.
- No automatic REAL apply exists. `v17_apply_test_to_real` requires a dedicated tool call plus server-side confirmation string `APPLIQUER_REEL`.
- No `service_role`, Google private key, Google access token, OAuth refresh token, or privileged secret is returned to ChatGPT, stored in HTML, Apps Script source, or committed to Git.
- Google source IDs may exist in server-side code; they are identifiers, not credentials.
- All eight sources must remain Google Sheets, use `Africa/Tunis`, keep expected titles/tabs, and remain owned by `souhail.souai@fst.utm.tn`.
- Source writes are rejected unless the spreadsheet ID, expected title, expected tab, and source kind all match the allowlist.
- Every MCP write is audited with actor, role, OAuth client id, tool name, source id, batch id when applicable, before/after summary, timestamp, and result.
- Migration filenames must be created at implementation time with `supabase migration new <name>`; contract tests locate migrations by suffix.
- Before implementing OAuth/MCP runtime code, re-read the current official OpenAI custom MCP app docs and current Supabase OAuth/MCP/Edge Function docs because these APIs are in active beta.

## Canonical Google Source Manifest

The connector uses these exact eight sources:

```ts
export const SOURCES = {
  teachers: {
    id: '1HDenoJmRejeDWN3KQnkYc0zgWbxiuEsS99nyCDrXb7g',
    title: 'Enseignants',
    kind: 'teachers',
    tabs: ['Enseignants'],
  },
  assignments: {
    id: '1yWsZl6sVnGs9OLlx74Sn7_wYyn8Uqe99Xkc4uxCjShc',
    title: 'Affectation enseignants par manipulation - TP Physique 2026-2027',
    kind: 'assignments',
    tabs: ['Affectation', 'Enseignants_Source'],
  },
  planningMonday: {
    id: '1xaJd4eA78yZpajy_w51wTmXhkmBrrmC4Ig0JB1Yag64',
    title: 'PLANNING_Lundi_MPI1-A & MPI1-E',
    kind: 'planning',
    tabs: ['Planning'],
  },
  planningThursday: {
    id: '184sGyMjyPoDLGVDwOjabjFevqlaSxc5bpULDPqZiGPM',
    title: 'PLANNING_Jeudi_MPI1-C & MPI1-D',
    kind: 'planning',
    tabs: ['Planning'],
  },
  planningFriday: {
    id: '1JdVI_GIbr0-boXNvxCPPnkJGUwZxiP0i2jLqKn7k-tc',
    title: 'PLANNING_Vendredi_MPI1-B & PC1-A',
    kind: 'planning',
    tabs: ['Planning'],
  },
  rosterMonday: {
    id: '1m2sxrQkoxFgwOSt8JAkOiONIWkVrOBFwqquO9w3-PvI',
    title: 'Cahier_Presence_MPI1A_MPI1E_Lundi',
    kind: 'roster',
    tabs: ['MPI1-A G1','MPI1-A G2','MPI1-A G3','MPI1-A G4','MPI1-E G1','MPI1-E G2','MPI1-E G3','MPI1-E G4'],
  },
  rosterThursday: {
    id: '1SZYVM78kP8RT2DCQuoV81r3dcmfOErwduWaDCb41WG0',
    title: 'Cahier_Presence_MPI1C_MPI1D_Jeudi',
    kind: 'roster',
    tabs: ['MPI1-C G1','MPI1-C G2','MPI1-C G3','MPI1-C G4','MPI1-D G1','MPI1-D G2','MPI1-D G3','MPI1-D G4'],
  },
  rosterFriday: {
    id: '1mXYqpxUesjxiWTogZqE5XU1WWTxkIXQF_gYoRVN181M',
    title: 'Cahier_Presence_MPI1B_PC1A_Vendredi',
    kind: 'roster',
    tabs: ['MPI1-B G1','MPI1-B G2','MPI1-B G3','MPI1-B G4','PC1-A G1','PC1-A G2','PC1-A G3','PC1-A G4'],
  },
} as const;
```

---

### Task 1: Fix V16 roster family compatibility and lock the current Sheet contracts

**Files:**
- Modify: `web/v16-student-groups.js`
- Create migration with: `supabase migration new v17_student_family_compatibility`
- Create: `tests/web/v17-student-family-compat.test.cjs`
- Create: `tests/fixtures/v17-google-sources/planning-monday.json`
- Create: `tests/fixtures/v17-google-sources/assignments.json`
- Create: `tests/fixtures/v17-google-sources/roster-sample.json`

**Interfaces:**
- Preserve `public.v16_students_for_session(uuid,text)` signature.
- `classFamily('MPI1-A-G1') -> 'MPI1-A'` and `classFamily('MPI1-A G1') -> 'MPI1-A'`.
- Fixtures must encode the current bounded source layouts: Planning `A1:J25`, Affectation `A1:I9`, roster group `A1:Z19`.

- [ ] **Step 1: Write the failing compatibility test.**

```js
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
function migration(suffix){
  const name=fs.readdirSync('supabase/migrations').find(x=>x.endsWith(suffix));
  assert.ok(name,`${suffix} missing`);
  return fs.readFileSync(path.join('supabase/migrations',name),'utf8');
}
test('V16 roster maps concrete group class names to session family',()=>{
  const sql=migration('_v17_student_family_compatibility.sql');
  assert.match(sql,/regexp_replace\s*\(\s*c\.name/i);
  assert.match(sql,/c\.group_number\s*=\s*m\.group_no/i);
});
test('web group family handles hyphenated DB class names',()=>{
  const src=fs.readFileSync('web/v16-student-groups.js','utf8');
  assert.match(src,/\[-\\s\]G\[1-4\]\$/i);
});
```

- [ ] **Step 2: Run RED.** `node --test tests/web/v17-student-family-compat.test.cjs` must fail because the migration is absent/current regex is insufficient.
- [ ] **Step 3: Generate the migration** and replace the class match in `v16_students_for_session` with the equivalent of:

```sql
regexp_replace(c.name,'[-[:space:]]G[1-4]$','','i') = s.class_name
and c.group_number = m.group_no
```

Preserve all existing authorization filters and soft-delete checks.
- [ ] **Step 4: Update the Web helper** to strip both `-G1` and ` G1`; when choosing current membership, require `effective_from <= current_date` and `(effective_to is null or current_date < effective_to)`.
- [ ] **Step 5: Save the three sanitized fixtures from the current Sheets.** The planning fixture must contain the current Monday alternation and DS row; the assignment fixture must contain M1–M6/rooms without personal secrets; the roster fixture must contain one blank group with headers plus hidden `V17_STATUT`/`V17_ID` columns.
- [ ] **Step 6: Run dedicated + existing V16 student tests.** Require GREEN.
- [ ] **Step 7: Commit:** `fix: align V16 roster families with V17 sources`.

---

### Task 2: Add V17 composite-source staging, MCP audit, source keys, and deletion tombstones

**Files:**
- Create migration with: `supabase migration new v17_mcp_sync_schema`
- Create: `tests/web/v17-mcp-schema-sql.test.cjs`

**Interfaces:**
- Tables: `v17_sync_sources`, `v17_sync_batches`, `v17_sync_teacher_rows`, `v17_sync_assignment_rows`, `v17_sync_student_rows`, `v17_sync_planning_rows`, `v17_sync_issues`, `v17_student_source_keys`, `v17_student_deletion_tombstones`, `v17_mcp_audit_log`.
- Public tables have RLS enabled. Mutating policies are Admin-only. Audit insertion occurs through a private helper, not direct client insert.

- [ ] **Step 1: Write RED schema tests** requiring all ten tables, RLS, Admin policies, FK/unique constraints, and the exact source kinds `teachers|assignments|planning|roster`.
- [ ] **Step 2: Run** `node --test tests/web/v17-mcp-schema-sql.test.cjs` and verify RED.
- [ ] **Step 3: Generate migration** and create these core contracts:

```text
v17_sync_sources:
  id uuid PK
  source_key text UNIQUE NOT NULL
  source_kind text CHECK teachers|assignments|planning|roster
  spreadsheet_id text UNIQUE NOT NULL
  expected_title text NOT NULL
  owner_email text NOT NULL DEFAULT 'souhail.souai@fst.utm.tn'
  timezone text NOT NULL DEFAULT 'Africa/Tunis'
  enabled boolean NOT NULL DEFAULT true

v17_sync_batches:
  id uuid PK
  fingerprint text UNIQUE NOT NULL
  trigger_mode text CHECK mcp_manual|mcp_preview|scheduled
  state text CHECK fetched|invalid|validated|loaded_to_test|applied|rejected|superseded
  source_fingerprints jsonb NOT NULL
  actor_id uuid REFERENCES profiles(id)
  created_at timestamptz DEFAULT now()
  applied_at timestamptz

v17_sync_teacher_rows:
  batch_id uuid, source_row int, display_name text, profile_id uuid nullable
  UNIQUE(batch_id,display_name)

v17_sync_assignment_rows:
  batch_id uuid, manipulation_code text, title text, room text,
  teacher1_id uuid nullable, teacher2_id uuid nullable,
  teacher1_name text, teacher2_name text,
  UNIQUE(batch_id,manipulation_code)

v17_sync_student_rows:
  batch_id uuid, source_key text, source_tab text, source_row int,
  v17_id uuid, display_name text, class_name text, group_no int,
  status text CHECK active|delete_requested
  UNIQUE(batch_id,source_key,source_tab,source_row),
  UNIQUE(batch_id,v17_id)

v17_sync_planning_rows:
  batch_id uuid, source_key text, session_date date, start_time time, end_time time,
  class_name text, group_no int, manipulation_code text, room text,
  UNIQUE(batch_id,session_date,class_name,group_no)

v17_sync_issues:
  batch_id uuid, severity text CHECK blocker|warning, code text,
  source_key text, source_tab text, source_row int, message text

v17_student_source_keys:
  source_key text, source_tab text, source_row int, v17_id uuid UNIQUE,
  student_id uuid UNIQUE REFERENCES students(id) ON DELETE CASCADE,
  UNIQUE(source_key,source_tab,source_row)

v17_student_deletion_tombstones:
  v17_id uuid PRIMARY KEY,
  former_student_id uuid NOT NULL,
  source_key text NOT NULL, source_tab text NOT NULL, source_row int NOT NULL,
  deleted_by uuid REFERENCES profiles(id), deleted_at timestamptz DEFAULT now(),
  dependency_counts jsonb NOT NULL

v17_mcp_audit_log:
  id bigint identity PK, actor_id uuid, actor_role text, oauth_client_id text,
  tool_name text, source_resource_id text, batch_id uuid nullable,
  before_summary jsonb, after_summary jsonb, result_status text,
  error_code text nullable, created_at timestamptz DEFAULT now()
```

- [ ] **Step 4: Seed the eight source rows idempotently** using the Canonical Google Source Manifest IDs/titles.
- [ ] **Step 5: Add `private.v17_mcp_audit(...)`** as `SECURITY DEFINER`, with `search_path=''`, inserting only normalized metadata; revoke direct public execute and grant only through the server-facing RPCs that need it.
- [ ] **Step 6: Run schema tests and relevant V16 SQL contract tests.** Require GREEN.
- [ ] **Step 7: Commit:** `feat: add V17 MCP synchronization schema`.

---

### Task 3: Implement V17 snapshot normalization, validation, TEST loading, and explicit REAL apply RPCs

**Files:**
- Create migration with: `supabase migration new v17_mcp_sync_rpcs`
- Create: `tests/web/v17-mcp-sync-rpcs-sql.test.cjs`

**Interfaces:**
- `public.v17_stage_sheet_snapshot(p_fingerprint text,p_source_fingerprints jsonb,p_teachers jsonb,p_assignments jsonb,p_students jsonb,p_planning jsonb) -> jsonb`
- `public.v17_preview_sync(p_batch_id uuid) -> jsonb`
- `public.v17_load_sync_to_test(p_batch_id uuid) -> jsonb`
- `public.v17_apply_test_to_real(p_batch_id uuid,p_confirmation text) -> jsonb`
- Private helpers: `private.v17_resolve_teacher_name(text)`, `private.v17_resolve_class(text,int)`, `private.v17_validate_batch(uuid)`.

- [ ] **Step 1: Write RED tests** requiring authenticated actor, Admin-only mutators, idempotent fingerprinting, 6-teacher resolution from `v515_teacher_constraints`, exactly 2 teachers per M1–M6, 24 valid group tabs, 32 teaching sessions, 128 planning rows, DS/holiday exclusion, room resolution, source freshness, and explicit REAL confirmation.
- [ ] **Step 2: Run the SQL contract test and verify RED.**
- [ ] **Step 3: Generate the migration and implement teacher resolution.** `private.v17_resolve_teacher_name` must return exactly one active profile that is already present in `v515_teacher_constraints`; unknown/duplicate normalized names return null and create a blocker. Never insert/update `profiles` or `auth.users`.
- [ ] **Step 4: Implement snapshot staging.** Insert the composite snapshot in one transaction; if the fingerprint exists, return the existing batch; supersede only older non-applied batches.
- [ ] **Step 5: Implement validation.** Required blocker codes:

```text
SOURCE_MISMATCH
TEACHER_COUNT_INVALID
TEACHER_UNKNOWN
MANIPULATION_MISSING
MANIPULATION_TEACHERS_INVALID
MANIPULATION_TEACHER_COUNT_INVALID
CLASS_GROUP_INVALID
STUDENT_ID_DUPLICATE
STUDENT_TOMBSTONED
PLANNING_DATE_INVALID
PLANNING_ROW_COUNT_INVALID
ROOM_INVALID
V16_TEACHER_NOT_ALLOWED_FOR_MANIPULATION
V16_VALIDATION_FAILED
BATCH_SUPERSEDED
```

- [ ] **Step 6: Implement TEST loading.** Clone REAL→TEST using existing V16 RPCs, then update only TEST `manipulation_code` and `room` for matching date/class/group rows. Preserve cloned `teacher_id`. For every TEST assignment, verify its teacher is one of the two allowed teachers for that manipulation; otherwise return `V16_TEACHER_NOT_ALLOWED_FOR_MANIPULATION` and leave TEST unapplied.
- [ ] **Step 7: Implement preview** with counts and blockers/warnings. Expected zero-change production baseline after synchronized no-op:

```json
{
  "ok": true,
  "planning": {"rows":128,"structural_changes":0},
  "sessions": 32,
  "blockers": [],
  "eligible_for_test": true,
  "eligible_for_real": true
}
```

- [ ] **Step 8: Implement explicit REAL apply.** Reject unless `p_confirmation = 'APPLIQUER_REEL'`; lock the batch, re-run freshness + V16 preview, call existing V16 apply RPCs, mark batch applied, and audit. No scheduled path may call this function.
- [ ] **Step 9: Run dedicated SQL tests and the full V16 planning suite.** Require GREEN.
- [ ] **Step 10: Commit:** `feat: stage V17 sheet snapshots through V16 TEST`.

---

### Task 4: Add permanent student deletion RPC with dependency counts and resurrection protection

**Files:**
- Create migration with: `supabase migration new v17_permanent_student_delete`
- Create: `tests/web/v17-permanent-student-delete-sql.test.cjs`

**Interfaces:**
- `public.v17_delete_student_permanently(p_student_id uuid,p_source_key text,p_source_tab text,p_source_row int,p_v17_id uuid) -> jsonb`
- No name parameter is accepted.

- [ ] **Step 1: Write RED tests** requiring Admin authorization, stable ID matching, row lock, dependency counting, explicit deletes from `attendance` and `v16_student_group_memberships`, tombstone insert, source-key delete, student delete last, audit write, and transaction rollback on error.
- [ ] **Step 2: Run RED.**
- [ ] **Step 3: Generate the migration and implement target verification.** Require an exact `v17_student_source_keys` row matching all of `student_id`, `v17_id`, `source_key`, `source_tab`, and `source_row`; otherwise raise `STUDENT_NOT_FOUND`/`SOURCE_MISMATCH`.
- [ ] **Step 4: Implement transactional deletion in this order:**

```sql
select id from public.students where id=p_student_id for update;
select count(*) from public.attendance where student_id=p_student_id;
select count(*) from public.v16_student_group_memberships where student_id=p_student_id;
insert into public.v17_student_deletion_tombstones(...dependency_counts...);
delete from public.attendance where student_id=p_student_id;
delete from public.v16_student_group_memberships where student_id=p_student_id;
delete from public.v17_student_source_keys where student_id=p_student_id;
delete from public.students where id=p_student_id;
```

Insert audit before returning; any exception must roll back all rows including tombstone/audit from that failed transaction.
- [ ] **Step 5: Return exact dependency counts:**

```json
{"ok":true,"student_id":"...","attendance_deleted":6,"memberships_deleted":1,"tombstoned":true}
```

- [ ] **Step 6: Run delete tests plus completed-session grade/presence regression tests.** Require GREEN.
- [ ] **Step 7: Commit:** `feat: add audited permanent student deletion`.

---

### Task 5: Add Supabase OAuth consent flow to the existing Web app

**Files:**
- Create: `web/v17-oauth-consent.js`
- Modify: `web/online-runtime.js`
- Modify: `scripts/build_online_web.py`
- Modify: `scripts/build_single_file_release.py`
- Create: `tests/web/v17-oauth-consent.test.cjs`

**Interfaces:**
- Authorization path configured in Supabase OAuth Server: `/index.html`.
- Query parameter: `authorization_id`.
- Uses `supabaseClient.auth.oauth.getAuthorizationDetails`, `.approveAuthorization`, `.denyAuthorization`.
- Existing sign-in remains the only login mechanism; consent logic resumes after normal login.

- [ ] **Step 1: Re-read current Supabase OAuth Server getting-started docs** and confirm the three OAuth JS method names remain unchanged before coding.
- [ ] **Step 2: Write RED contract test** requiring extraction/preservation of `authorization_id`, `getAuthorizationDetails`, approve, deny, and no secret/client credential literals in the Web bundle.
- [ ] **Step 3: Implement `V17OAuthConsent`.** On load, if `authorization_id` exists, store it in `sessionStorage`, call `getSession()`, and if signed in render a consent overlay showing the OAuth client name and requested scopes. If `getAuthorizationDetails` returns a redirect object, redirect immediately.
- [ ] **Step 4: Implement decisions:**

```js
const approved=await supabaseClient.auth.oauth.approveAuthorization(id);
if(approved.error) throw approved.error;
location.assign(approved.data.redirect_url);
```

Use the equivalent deny method for refusal.
- [ ] **Step 5: Add one hook after successful `doLogin` in `online-runtime.js`:**

```js
if (window.V17OAuthConsent?.hasPendingAuthorization()) {
  await window.V17OAuthConsent.resumeAfterLogin();
}
```

Do not alter normal login behavior when no OAuth authorization is pending.
- [ ] **Step 6: Add the module to both build paths and run Web syntax/tests.** Require GREEN and confirm generated `web/index.html` contains the inline V17 OAuth marker.
- [ ] **Step 7: Commit:** `feat: add Supabase OAuth consent UI for MCP`.

---

### Task 6: Scaffold the remote MCP Edge Function with OAuth protected-resource authentication

**Files:**
- Create: `supabase/config.toml` if absent; otherwise modify only the V17 function section
- Create: `supabase/functions/v17-mcp/deno.json`
- Create: `supabase/functions/v17-mcp/index.ts`
- Create: `supabase/functions/v17-mcp/_shared/errors.ts`
- Create: `supabase/functions/v17-mcp/_shared/auth.ts`
- Create: `supabase/functions/v17-mcp/tests/auth.test.ts`

**Interfaces:**
- Remote endpoint: `/functions/v1/v17-mcp/mcp`.
- Health endpoint: `/functions/v1/v17-mcp/health`.
- Function gateway JWT verification must be disabled so MCP OAuth discovery/401 can run; bearer validation happens inside the function.
- Missing token returns 401 with MCP OAuth protected-resource metadata; invalid token returns 401; authenticated token yields actor context.

- [ ] **Step 1: Re-read current OpenAI custom MCP app docs, Supabase MCP auth docs, and `mcp-lite` Edge Function example.** Pin the versions currently documented unless a newer compatible stable version is explicitly required.
- [ ] **Step 2: Write RED Deno auth tests** for missing token, invalid token, valid authenticated user, and Admin role resolution.
- [ ] **Step 3: Configure Deno imports:**

```json
{
  "compilerOptions":{"lib":["deno.window","deno.ns"],"strict":true},
  "imports":{
    "hono":"npm:hono@^4.6.14",
    "mcp-lite":"npm:mcp-lite@0.8.2",
    "zod":"npm:zod@^4.1.12",
    "@supabase/server":"npm:@supabase/server@^1"
  }
}
```

- [ ] **Step 4: Configure the function** with `verify_jwt = false` for `v17-mcp`, because the MCP resource metadata and OAuth 401 challenge must reach function code.
- [ ] **Step 5: Implement MCP skeleton** using Hono + `McpServer` + `StreamableHttpTransport`, mounted at `/v17-mcp/mcp` per the Supabase two-Hono-app routing pattern.
- [ ] **Step 6: Wrap the handler with Supabase OAuth protected-resource metadata and verified user claims.** The inner handler must reject anonymous calls and provide an RLS-scoped Supabase client bearing the OAuth user token.
- [ ] **Step 7: Add `resolveActor()`** that queries the current user's profile and returns `{userId,email,role,oauthClientId}`; write tools call `requireAdmin(actor)` and read tools may allow existing teacher read access where specified.
- [ ] **Step 8: Run `deno test supabase/functions/v17-mcp/tests/auth.test.ts`.** Require GREEN.
- [ ] **Step 9: Commit:** `feat: scaffold authenticated V17 MCP edge server`.

---

### Task 7: Add server-side Google authentication, source verification, and bounded Sheets access

**Files:**
- Create: `supabase/functions/v17-mcp/_shared/sources.ts`
- Create: `supabase/functions/v17-mcp/_shared/google-auth.ts`
- Create: `supabase/functions/v17-mcp/_shared/google-sheets.ts`
- Create: `supabase/functions/v17-mcp/tests/google-sources.test.ts`

**Interfaces:**
- Secrets: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` only in Supabase secrets.
- OAuth scopes: `https://www.googleapis.com/auth/spreadsheets` and `https://www.googleapis.com/auth/drive.metadata.readonly`.
- `verifySource(sourceKey) -> {spreadsheetId,title,timeZone,tabs}`.
- `readRange(sourceKey,tab,a1)` and `writeRange(sourceKey,tab,a1,values)` reject unlisted tabs/ranges.

- [ ] **Step 1: Write RED tests** with mocked fetch for service-account token exchange, Drive metadata, Sheets metadata, valid allowlisted range, wrong owner, wrong title, wrong timezone, unknown source, and unknown tab.
- [ ] **Step 2: Implement the Canonical Google Source Manifest** exactly as defined above plus `ownerEmail:'souhail.souai@fst.utm.tn'` and `timeZone:'Africa/Tunis'`.
- [ ] **Step 3: Implement service-account token acquisition** using a signed JWT assertion with WebCrypto and Google's OAuth token endpoint. Normalize the private key secret by converting literal `\n` sequences to newlines only inside server code. Cache access token in-memory until 60 seconds before expiry.
- [ ] **Step 4: Implement `verifySource`.** Call Drive metadata and Sheets metadata; require native Google Sheet MIME type, exact title, expected owner email, `Africa/Tunis`, and required tabs.
- [ ] **Step 5: Implement bounded ranges.** Allow only:

```text
teachers: Enseignants!A1:A20
assignments: Affectation!A1:I20, Enseignants_Source!A1:A20
planning*: Planning!A1:J40
roster*: each configured group tab A1:Z19
```

Write operations are narrower: teacher names `A2:A20`; assignment teachers `D4:E9`; roster student name/status/id rows `B8:B19`, `Y8:Z19`, and deletion row clear `B8:H19` plus `Y8:Z19` for one row.
- [ ] **Step 6: Run Deno Google-source tests.** Require GREEN.
- [ ] **Step 7: Commit:** `feat: add verified Google Sheets server adapter`.

---

### Task 8: Implement read-only MCP tools for sources, teachers, assignments, students, planning, and sync status

**Files:**
- Create: `supabase/functions/v17-mcp/tools/read-tools.ts`
- Create: `supabase/functions/v17-mcp/_shared/normalize.ts`
- Create: `supabase/functions/v17-mcp/tests/read-tools.test.ts`
- Modify: `supabase/functions/v17-mcp/index.ts`

**Interfaces:**
- Tools: `v17_list_sources`, `v17_get_sync_status`, `v17_list_teachers`, `v17_get_manipulation_assignments`, `v17_list_students`, `v17_get_planning`.

- [ ] **Step 1: Write RED tests** asserting exact tool names, input schemas, bounded source reads, French error codes, and that no output contains Google access tokens/private keys/Supabase secrets.
- [ ] **Step 2: Implement teacher normalization.** Read `Enseignants!A1:A20`, deduplicate case-insensitively, require exactly six non-empty names, resolve each name against current `v515_teacher_constraints` profiles, and return profile id/name/email/role only for display; never mutate accounts.
- [ ] **Step 3: Implement assignment normalization.** Read rows 4–9 and return M1–M6, title, room, teacher1, teacher2, plus calculated count per teacher and `ok` state.
- [ ] **Step 4: Implement roster normalization.** For each of 24 tabs, rows 8–19, parse `B` as display name, `Y` as status, `Z` as `V17_ID`; never parse first/last name heuristically. Output `{sourceKey,sheet,row,v17Id,name,className,groupNo,status}`.
- [ ] **Step 5: Implement planning normalization.** Parse each configured planning sheet's class headers and alternating teaching rows into normalized `{date,start,end,className,groupNo,manipulation,room}`; obtain room from the authoritative assignment matrix M1–M6. Skip the DS row and blank rows. Across all three planning sources, require 32 sessions / 128 group rows.
- [ ] **Step 6: Implement `v17_get_sync_status`** from `v17_sync_batches` with current batch state/fingerprint/blockers.
- [ ] **Step 7: Register all six read tools and run Deno tests.** Require GREEN.
- [ ] **Step 8: Commit:** `feat: expose V17 read tools through MCP`.

---

### Task 9: Implement Admin teacher/manipulation and student upsert write tools

**Files:**
- Create: `supabase/functions/v17-mcp/tools/write-tools.ts`
- Create: `supabase/functions/v17-mcp/tests/write-tools.test.ts`
- Modify: `supabase/functions/v17-mcp/index.ts`

**Interfaces:**
- `v17_sync_teacher_selection()`
- `v17_validate_manipulation_assignments()`
- `v17_update_manipulation_assignment(manipulation,teacher1,teacher2)`
- `v17_upsert_student(source_key,sheet,row,name,student_id?)`

- [ ] **Step 1: Write RED tests** for Admin-only writes, unknown source rejection, unknown teacher rejection, duplicate teacher rejection, two-manipulations-per-teacher validation, stable `V17_ID`, row bounds 8–19, and audit calls.
- [ ] **Step 2: Implement `v17_sync_teacher_selection`.** Read visible `Enseignants`, validate the six names against current configured profiles, then rewrite only `Enseignants_Source!A1:A20` with header + six names. Do not modify Supabase Auth/profile rows.
- [ ] **Step 3: Implement manipulation validation** with exactly six M rows, two distinct teachers per row, every teacher from the six-name source, and total count exactly two per teacher.
- [ ] **Step 4: Implement `v17_update_manipulation_assignment`.** Read current D4:E9, replace only the requested manipulation row in-memory, validate the entire prospective matrix, then write exactly that row's D:E cells and audit before/after names. Reject the write if the complete matrix would be invalid.
- [ ] **Step 5: Implement `v17_upsert_student`.** Validate source/tab/row, normalize full display name, reuse supplied/Sheet `V17_ID` if present, else generate `crypto.randomUUID()`. Write B row + Y=`ACTIVE` + Z=UUID. Then call a dedicated authenticated RPC that creates/updates the mapped student row and current group membership using `V17_ID`; for newly created students set `students.last_name = display_name` and `students.first_name = ''` rather than guessing name parts.
- [ ] **Step 6: Add/implement the student upsert RPC** in a generated migration `v17_mcp_student_upsert`, requiring Admin, source mapping, class/group resolution, stable UUID, no name-only matching, and no attendance mutations.
- [ ] **Step 7: Register tools and run Deno + SQL tests.** Require GREEN.
- [ ] **Step 8: Commit:** `feat: add guarded V17 sheet write tools`.

---

### Task 10: Implement permanent student deletion MCP tool and Google row cleanup

**Files:**
- Modify: `supabase/functions/v17-mcp/tools/write-tools.ts`
- Create: `supabase/functions/v17-mcp/tests/delete-tool.test.ts`

**Interfaces:**
- `v17_delete_student_permanently(student_id,source_context)` where `source_context={source_key,sheet,row,v17_id}`.
- Database deletion commits before Google row cleanup; tombstone prevents resurrection if cleanup fails.

- [ ] **Step 1: Write RED tests** for Admin-only invocation, no name argument, exact source-context verification, RPC call, successful row clear, cleanup-failure audit, and tombstone behavior.
- [ ] **Step 2: Implement tool flow:**

```text
1. requireAdmin(actor)
2. verify source/tab/row against allowlist
3. read B/Y/Z and require Z == source_context.v17_id
4. call v17_delete_student_permanently RPC
5. clear B:H for the row and Y:Z for the row, preserving column A number
6. if Google cleanup fails, return ok=true with sheet_cleanup='pending' and audit warning
7. future upsert/stage rejects the tombstoned V17_ID until the row is cleared
```

- [ ] **Step 3: Return a concise structured result** including DB dependency counts and `sheet_cleanup` state. Never return deleted attendance/grade/comment contents.
- [ ] **Step 4: Run deletion tool tests + permanent-delete SQL tests.** Require GREEN.
- [ ] **Step 5: Commit:** `feat: expose permanent student deletion through MCP`.

---

### Task 11: Implement planning staging, preview, TEST load, and explicit REAL tools

**Files:**
- Create: `supabase/functions/v17-mcp/tools/sync-tools.ts`
- Create: `supabase/functions/v17-mcp/tests/sync-tools.test.ts`
- Modify: `supabase/functions/v17-mcp/index.ts`

**Interfaces:**
- `v17_stage_planning_sync()`
- `v17_preview_sync(batch_id)`
- `v17_load_sync_to_test(batch_id)`
- `v17_apply_test_to_real(batch_id,confirmation)`

- [ ] **Step 1: Write RED tests** requiring Admin for mutators, full eight-source verification, deterministic fingerprint, staging-only behavior, no direct REAL writes, latest-batch rule, V16 preview reuse, and confirmation `APPLIQUER_REEL`.
- [ ] **Step 2: Implement deterministic snapshot fingerprint.** Sort normalized teacher names, M1–M6 assignment rows, students by source/tab/row, and planning by date/class/group; SHA-256 the canonical JSON.
- [ ] **Step 3: Implement `v17_stage_planning_sync`.** Verify all eight sources, read bounded ranges, normalize, call `v17_stage_sheet_snapshot`, and return batch id + validation summary. This tool must never call TEST or REAL apply automatically.
- [ ] **Step 4: Implement preview/load tools** as thin authenticated RPC wrappers. Preserve server error codes from SQL and audit each write.
- [ ] **Step 5: Implement REAL tool** requiring exact confirmation string and one explicit tool invocation; no other MCP tool calls it internally.
- [ ] **Step 6: Run sync tool tests and V16 planning regressions.** Require GREEN.
- [ ] **Step 7: Commit:** `feat: connect V17 MCP synchronization to V16 TEST`.

---

### Task 12: Harden Apps Script for local Sheet behavior only

**Files:**
- Modify: `apps-script/V17_Code.gs`
- Modify: `apps-script/v17-apps-script-core.cjs`
- Modify: `tests/web/v17-apps-script-core.test.cjs`

**Interfaces:**
- Keep: teacher-source sync helper, assignment validation, stable student IDs, installable edit triggers.
- Remove from routine architecture: `V17_TEST_ENDPOINT`, `V17_SYNC_TOKEN`, direct Apps Script POST to V17.

- [ ] **Step 1: Extend RED tests** to assert no `V17_TEST_ENDPOINT`, no `V17_SYNC_TOKEN`, no `UrlFetchApp.fetch` to the backend, and installable edit trigger support for all three roster workbooks.
- [ ] **Step 2: Implement `v17InstallerTriggers()`** that deletes only prior `v17OnStudentEdit` project triggers and creates one installable `onEdit` trigger per roster workbook.
- [ ] **Step 3: Keep `v17OnStudentEdit(e)`** to maintain `V17_ID` and `V17_STATUT`; clearing a populated name marks `DELETE_REQUESTED` but does not itself delete Supabase data.
- [ ] **Step 4: Remove the direct TEST push menu item/function.** Replace it with a local status/info action saying synchronization is performed through the V17 ChatGPT/MCP connector.
- [ ] **Step 5: Run Apps Script core tests.** Require GREEN.
- [ ] **Step 6: Commit:** `refactor: keep Apps Script local to Google Sheets`.

---

### Task 13: Extend CI, deploy safely, register the ChatGPT app, and verify production invariants

**Files:**
- Modify: `.github/workflows/build-web.yml`
- Modify: `README.md` or create `docs/v17-mcp-deployment.md`
- Create: `tests/web/v17-mcp-secret-scan.test.cjs`

**Interfaces:**
- CI runs Node Web tests, Deno MCP tests, JS syntax checks, Web builds, and secret scan.
- Production endpoint is the deployed `v17-mcp/mcp` URL.

- [ ] **Step 1: Write RED secret-scan test** rejecting `BEGIN PRIVATE KEY`, `service_role`, `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=` values, real bearer tokens, and `V17_SYNC_TOKEN` in tracked Web/Apps Script/MCP source.
- [ ] **Step 2: Update CI** to install Deno and run:

```bash
for test in tests/web/*.test.cjs; do node "$test"; done
deno test --allow-env --allow-net supabase/functions/v17-mcp/tests
python scripts/build_online_web.py
python scripts/build_single_file_release.py
```

Use test-time mocked network; production Google/Supabase calls must not run in CI.
- [ ] **Step 3: Run the complete local verification suite.** Require all V16/V17 tests and both Web builds green.
- [ ] **Step 4: Pre-deploy production invariants:** confirm 32 teaching sessions, 128 assignments, 0 room conflicts, and current V16 TEST→REAL preview structural_changes=0.
- [ ] **Step 5: Deploy SQL migrations first** on the linked Supabase project. Re-run invariants immediately; abort further deployment on any unexpected mutation.
- [ ] **Step 6: Enable Supabase OAuth 2.1 server** in Authentication → OAuth Server; set Authorization Path `/index.html`; enable dynamic client registration only if the current OpenAI MCP setup requires it. Keep user consent mandatory.
- [ ] **Step 7: Configure Google service account once.** Create a dedicated account such as `gestion-presence-v17@<project>.iam.gserviceaccount.com`, enable Sheets + Drive APIs, share only `Gestion-presence_TP_Prepa` with that service-account email as Editor, keep `souhail.souai@fst.utm.tn` as owner, and set the two Google secrets with `supabase secrets set`.
- [ ] **Step 8: Deploy `v17-mcp`** and verify `/health`, OAuth protected-resource metadata, unauthenticated 401, authenticated read tools, and Admin write gating.
- [ ] **Step 9: Register the custom app once in ChatGPT Workspace Settings → Apps → Create.** Use the remote MCP endpoint, OAuth authentication, run Scan Tools, complete Supabase authorization, and keep the app as a private draft until all tests pass.
- [ ] **Step 10: Live acceptance test in this order:** list sources → list six teachers → validate assignment matrix → list one roster group → stage planning → preview batch → load to TEST → verify no-op V16 preview → create a disposable test student in an unused row → delete it permanently → verify Sheet row cleared + tombstone/audit → verify attendance/grade/comment counts for unrelated students unchanged.
- [ ] **Step 11: Verify no automatic REAL path.** Confirm staging and Apps Script edits never call `v17_apply_test_to_real`; test the REAL tool only with a zero-change batch and explicit `APPLIQUER_REEL` after user confirmation.
- [ ] **Step 12: Final production evidence:**

```text
V16 regression suite: PASS
V17 MCP Deno tests: PASS
V17 SQL contract tests: PASS
Official sessions: 32
Official assignments: 128
Room conflicts: 0
Google sources verified: 8/8
Student group tabs verified: 24/24
Teacher accounts created/modified/deleted by Sheets: 0
Privileged secrets exposed in client/tool output: 0
Scheduled/Sheet automatic REAL applies: 0
Unrelated attendance/grade/comment mutations: 0
Permanent delete audit+tombstone: PASS
```

- [ ] **Step 13: Commit:** `ci: verify and document V17 ChatGPT MCP connector`.

---

## Plan Self-Review Results

- Spec coverage: all design requirements are assigned to Tasks 1–13, including OAuth, eight-source Google access, teacher protection, manipulation validation, 24 student tabs, stable IDs, permanent deletion, TEST staging, explicit REAL apply, audit, secret isolation, and deployment.
- Conflict resolved: the older one-workbook V17 sync plan is superseded for the direct ChatGPT connector by the eight-source manifest in this plan. Existing V16 rules and any compatible staging concepts are retained.
- Identity resolved: current roster Sheets have no matricule; connector identity therefore uses hidden `V17_ID` plus `v17_student_source_keys`, never student name alone.
- Planning semantics resolved: Google planning Sheets define class/group/manipulation rotation; current V16 teacher assignment is preserved in TEST and validated against the allowed teacher pair from the assignment Sheet.
- Permanent deletion semantics resolved: database delete is authoritative, Google cleanup follows, and tombstone prevents resurrection after partial external cleanup.
- No placeholders or deferred implementation steps remain in this plan.
