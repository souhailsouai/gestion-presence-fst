# Simple Authentication Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace MFA/AAL2 business authorization with a single authenticated PIN-or-password session while preserving RLS, role checks, rate limiting, audit, idempotency, and atomic attendance writes.

**Architecture:** Supabase remains the single source of truth. PIN authentication is handled server-side by an Edge Function; password authentication uses Supabase Auth. Business RPCs authorize by authenticated user identity plus role/ownership, never by MFA assurance level.

**Tech Stack:** Supabase Auth, PostgreSQL 17, PL/pgSQL, Deno Edge Functions, TypeScript.

**Spec:** `docs/superpowers/specs/2026-08-30-simple-auth-native-windows-design.md`

## Global Constraints

- Both `teacher` and `admin` accept username + PIN or username + password.
- No application business flow may require TOTP, MFA enrollment, MFA challenge, or `aal2`.
- PIN hashes remain server-side and unreadable by `anon`/`authenticated`.
- Existing production users, classes, students, sessions, attendance, grades, and audit data must be preserved.
- `save_attendance_sheet` remains atomic, idempotent, revision-aware, and audited.
- RLS remains enabled for application tables.

---

### Task 1: Add migration removing AAL2 business gates

**Files:**
- Create: `supabase/migrations/20260830_remove_mfa_business_gate.sql`
- Test: `tests/backend/test_simple_auth_contract.py`

**Interfaces:**
- Produces SQL functions that accept any valid `auth.uid()` session while preserving role/ownership checks.
- Produces `get_app_contract()` without an MFA business requirement.

- [ ] **Step 1: Write the failing contract test**

```python
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "supabase/migrations/20260830_remove_mfa_business_gate.sql"


def test_migration_removes_aal2_business_checks():
    sql = MIGRATION.read_text(encoding="utf-8")
    lowered = sql.lower()
    assert "aal2" not in lowered
    assert "auth.uid()" in lowered
    assert "save_attendance_sheet" in lowered
    assert "get_app_contract" in lowered
```

- [ ] **Step 2: Run the focused test and verify failure**

```bash
python -m pytest tests/backend/test_simple_auth_contract.py -q
```

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Add the migration**

The migration must redefine business functions without inspecting `auth.jwt()->>'aal'`. The first guard in `save_attendance_sheet` must be equivalent to:

```sql
if auth.uid() is null then
  return jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED', 'message', 'Session invalide.');
end if;
```

Keep the existing teacher/session ownership check, revision comparison, operation receipt lookup, transaction body, and audit insertion unchanged. Redefine `get_app_contract()` so its authentication section contains:

```sql
'authentication', jsonb_build_object(
  'methods', jsonb_build_array('pin', 'password'),
  'mfa_required', false
)
```

and remove any `enforce_business_writes` MFA flag.

- [ ] **Step 4: Run contract and database tests**

```bash
python -m pytest tests/backend/test_simple_auth_contract.py -q
```

Then apply to staging and verify:

```sql
select public.get_app_contract();
```

Expected: authentication methods `pin` and `password`, `mfa_required=false`, no AAL2 business flag.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260830_remove_mfa_business_gate.sql tests/backend/test_simple_auth_contract.py
git commit -m "feat(auth): remove MFA business gate"
```

---

### Task 2: Unify PIN and password login responses

**Files:**
- Create/Modify: `supabase/functions/pin-login/index.ts`
- Create: `supabase/functions/_shared/auth-response.ts`
- Test: `tests/backend/test_auth_response_contract.py`

**Interfaces:**
- `POST /functions/v1/pin-login` consumes `{ identifier, credential }` for PIN.
- Password clients use `/auth/v1/token?grant_type=password` after resolving the username to the account email through a server-side helper.
- Both flows expose the same client session fields: `access_token`, `refresh_token`, `expires_in`, `user_id`, `role`.

- [ ] **Step 1: Add failing response-contract tests**

```python
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_pin_login_has_no_mfa_response_fields():
    source = (ROOT / "supabase/functions/pin-login/index.ts").read_text(encoding="utf-8")
    assert "mfa_required" not in source
    assert "access_token" in source
    assert "refresh_token" in source
    assert "role" in source
```

- [ ] **Step 2: Run and confirm failure against the current implementation**

```bash
python -m pytest tests/backend/test_auth_response_contract.py -q
```

- [ ] **Step 3: Implement a shared response mapper**

```ts
// supabase/functions/_shared/auth-response.ts
export function sessionPayload(data: any, role: string) {
  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_in: data.session.expires_in,
    user_id: data.user.id,
    role,
  };
}
```

`pin-login/index.ts` must keep constant-time PIN verification, generic invalid-credential messages, and attempt throttling, then return `sessionPayload(...)` without MFA fields.

- [ ] **Step 4: Verify PIN failure, lockout, teacher role, and admin role in staging**

Run integration requests with staging test accounts. Expected responses:
- wrong PIN -> `401` with generic `UNAUTHENTICATED`;
- throttled attempts -> `429 RATE_LIMITED`;
- correct teacher PIN -> JWT session with `role=teacher`;
- correct admin PIN -> JWT session with `role=admin`.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/pin-login supabase/functions/_shared/auth-response.ts tests/backend/test_auth_response_contract.py
git commit -m "feat(auth): standardize PIN session response"
```

---

### Task 3: Add server-side username resolution for password login

**Files:**
- Create: `supabase/functions/password-login/index.ts`
- Create: `tests/backend/test_password_login_contract.py`

**Interfaces:**
- `POST /functions/v1/password-login` consumes `{ identifier, password }`.
- It resolves `profiles.username` server-side, then calls Supabase Auth password sign-in and returns the same session payload as PIN login.

- [ ] **Step 1: Write the failing contract test**

```python
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "supabase/functions/password-login/index.ts"


def test_password_login_never_exposes_email_lookup():
    text = SOURCE.read_text(encoding="utf-8")
    assert "signInWithPassword" in text
    assert "identifier" in text
    assert "mfa" not in text.lower()
```

- [ ] **Step 2: Verify failure**

```bash
python -m pytest tests/backend/test_password_login_contract.py -q
```

- [ ] **Step 3: Implement the Edge Function**

Use a service-role Supabase client only inside the Edge Function to resolve the lowercased username from `profiles`, reject disabled accounts, then use a normal anon client for `signInWithPassword({ email, password })`. Return the shared `sessionPayload` and never return the resolved email address.

- [ ] **Step 4: Verify staging behavior**

Expected:
- valid username/password -> session;
- wrong password -> generic `UNAUTHENTICATED`;
- missing username -> same generic error;
- disabled account -> `FORBIDDEN`;
- response contains no `mfa_required`, factor, email lookup, PIN hash, or service key.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/password-login/index.ts tests/backend/test_password_login_contract.py
git commit -m "feat(auth): add username password login endpoint"
```

---

### Task 4: Security regression tests and staged rollout

**Files:**
- Create: `tests/backend/test_authorization_regression.py`
- Create: `docs/release/simple-auth-backend-checklist.md`

**Interfaces:**
- Validates the backend contract consumed by Web, Android, and Windows plans.

- [ ] **Step 1: Add regression cases**

Cover:
- unauthenticated read/write denied;
- teacher A cannot read/write teacher B private rows;
- teacher cannot execute admin teacher-management operations;
- admin can execute authorized admin operations;
- `save_attendance_sheet` accepts an authenticated AAL1 JWT;
- stale revision returns `VERSION_CONFLICT`;
- duplicate `operation_id` returns the existing receipt without double write.

- [ ] **Step 2: Run against staging**

```bash
python -m pytest tests/backend/test_authorization_regression.py -q
```

Expected: all cases PASS.

- [ ] **Step 3: Capture pre-production counts**

Record metadata-only counts for `profiles`, `classes`, `students`, `sessions`, `attendance`, and `audit_logs` in `docs/release/simple-auth-backend-checklist.md`.

- [ ] **Step 4: Apply migrations/functions to production and re-run non-destructive verification**

Expected: row counts are preserved, RLS enabled, login endpoints available, and no business function references `aal2`.

- [ ] **Step 5: Commit verification documentation**

```bash
git add tests/backend/test_authorization_regression.py docs/release/simple-auth-backend-checklist.md
git commit -m "test(auth): verify simple authentication authorization"
```

## Completion Gate

- PIN and password login both return equivalent Supabase sessions.
- No business RPC or Edge Function requires MFA/AAL2.
- Teacher isolation and admin authorization remain enforced server-side.
- Attendance remains atomic, idempotent, revision-aware, and audited.
- Production data counts are preserved across deployment.
