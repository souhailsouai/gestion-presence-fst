# Web and Android Simple Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Web and Android authenticate teachers/admins using username + PIN or username + password only, with no MFA/TOTP UI or AAL2 gate.

**Architecture:** Both clients consume the same backend login/session contract and retain role-based server authorization. Android remains native Compose and online-only; Web preserves the approved HTML behavior and visual reference.

**Tech Stack:** HTML/CSS/JavaScript, Kotlin, Jetpack Compose, Ktor, kotlinx.serialization, Android Keystore, Supabase HTTP APIs.

**Spec:** `docs/superpowers/specs/2026-08-30-simple-auth-native-windows-design.md`

## Global Constraints

- Credential modes are exactly `pin` and `password`.
- No TOTP enrollment/challenge, factor listing, MFA screen, `MFA_REQUIRED`, or AAL2 gate.
- PIN/password values are never persisted in client storage.
- Android remains online-only and has no WebView business UI.
- Existing PostgREST singleton-array fix must remain covered by tests.

---

### Task 1: Define common client login behavior

**Files:**
- Create: `shared/auth-contract.json`
- Create: `tests/test_auth_contract.py`

**Interfaces:**
- Produces credential modes and stable session/error field names consumed by Web, Android, and Windows.

- [ ] **Step 1: Add failing contract test**

```python
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_auth_contract_has_only_primary_credentials():
    data = json.loads((ROOT / "shared/auth-contract.json").read_text())
    assert data["credential_modes"] == ["pin", "password"]
    assert "MFA_REQUIRED" not in data["errors"]
```

- [ ] **Step 2: Run and verify failure**

```bash
python -m pytest tests/test_auth_contract.py -q
```

- [ ] **Step 3: Create the contract**

```json
{
  "credential_modes": ["pin", "password"],
  "session_fields": ["access_token", "refresh_token", "expires_in", "user_id", "role"],
  "errors": ["NETWORK_UNAVAILABLE", "UNAUTHENTICATED", "SESSION_EXPIRED", "FORBIDDEN", "VALIDATION_ERROR", "VERSION_CONFLICT", "RATE_LIMITED", "SERVER_UNAVAILABLE", "INTERNAL_ERROR"]
}
```

- [ ] **Step 4: Re-run test**

```bash
python -m pytest tests/test_auth_contract.py -q
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/auth-contract.json tests/test_auth_contract.py
git commit -m "docs(auth): define primary credential contract"
```

---

### Task 2: Remove Web MFA flow and add credential selector

**Files:**
- Modify: `web/index.html`
- Test: `tests/test_web_simple_auth.py`

**Interfaces:**
- `login(identifier, credential, mode)` selects `/functions/v1/pin-login` or `/functions/v1/password-login`.

- [ ] **Step 1: Add failing static regression test**

```python
from pathlib import Path

HTML = (Path(__file__).resolve().parents[1] / "web/index.html").read_text(encoding="utf-8")


def test_web_has_pin_password_without_mfa():
    lower = HTML.lower()
    assert 'value="pin"' in lower
    assert 'value="password"' in lower
    assert "totp" not in lower
    assert "mfa_required" not in lower
    assert "challengeandverify" not in lower
```

- [ ] **Step 2: Run and verify RED**

```bash
python -m pytest tests/test_web_simple_auth.py -q
```

- [ ] **Step 3: Implement the Web login switch**

Use one selector with `PIN` and `Mot de passe`. Submit:

```js
const endpoint = credentialMode === 'pin' ? 'pin-login' : 'password-login';
const payload = credentialMode === 'pin'
  ? { identifier, credential }
  : { identifier, password: credential };
```

After receiving a valid session, enter the application immediately. Remove all TOTP/factor enrollment/challenge DOM and JavaScript.

- [ ] **Step 4: Run Web regression tests**

```bash
python -m pytest tests/test_web_simple_auth.py tests/test_auth_contract.py -q
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/index.html tests/test_web_simple_auth.py
git commit -m "feat(web): use PIN or password login only"
```

---

### Task 3: Remove Android MFA domain/API surface

**Files:**
- Modify: `app-native/src/main/java/tn/utm/fst/gestionpresence/nativeapp/data/remote/OnlineApiClient.kt`
- Modify: Android auth models/repository files containing `MfaFactor`, `MfaEnrollment`, `mfaRequired`, or assurance-level logic.
- Test: `app-native/src/test/java/tn/utm/fst/gestionpresence/nativeapp/data/remote/SimpleAuthApiTest.kt`
- Preserve: `app-native/src/test/java/tn/utm/fst/gestionpresence/nativeapp/data/remote/JsonResponseShapeTest.kt`

**Interfaces:**
- `login(identifier: String, credential: String, mode: CredentialMode): AuthSession`
- `enum class CredentialMode { PIN, PASSWORD }`

- [ ] **Step 1: Add failing Android auth test**

```kotlin
@Test
fun credentialModesContainOnlyPinAndPassword() {
    assertEquals(listOf(CredentialMode.PIN, CredentialMode.PASSWORD), CredentialMode.entries)
}
```

Add a source regression assertion that `OnlineApiClient` exposes no `mfaFactors`, `enrollMfa`, `verifyMfa`, `unenrollMfa`, or `assuranceLevel` methods.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
./gradlew :app-native:testDebugUnitTest --tests '*SimpleAuthApiTest' --tests '*JsonResponseShapeTest'
```

- [ ] **Step 3: Implement primary-credential login**

```kotlin
enum class CredentialMode { PIN, PASSWORD }

suspend fun login(identifier: String, credential: String, mode: CredentialMode): AuthSession {
    val function = if (mode == CredentialMode.PIN) "pin-login" else "password-login"
    val key = if (mode == CredentialMode.PIN) "credential" else "password"
    // POST identifier + key/credential, parse standard session payload.
}
```

Remove MFA models, API calls, `mfaRequired` session/profile fields, and AAL checks. Keep secure session-token storage and refresh/logout.

- [ ] **Step 4: Preserve JSON singleton fix and run tests/lint**

```bash
./gradlew :app-native:testDebugUnitTest :app-native:lintDebug
```

Expected: all tests PASS, including object/singleton-array/multi-row response-shape tests.

- [ ] **Step 5: Commit**

```bash
git add app-native
git commit -m "feat(android): use PIN or password without MFA"
```

---

### Task 4: Replace Android MFA UI with credential-mode UI

**Files:**
- Modify: Compose login/auth screen and ViewModel files under `app-native/src/main/java/tn/utm/fst/gestionpresence/nativeapp/`
- Test: corresponding ViewModel/unit tests.

**Interfaces:**
- Login state contains `identifier`, `credential`, `credentialMode`, `isLoading`, and typed error only.

- [ ] **Step 1: Add failing ViewModel tests**

Verify:
- default mode is PIN;
- selecting PASSWORD changes the mode;
- successful primary login navigates directly to the authorized home screen;
- no state/action references MFA enrollment or verification.

- [ ] **Step 2: Run tests and verify RED**

```bash
./gradlew :app-native:testDebugUnitTest
```

- [ ] **Step 3: Implement the Compose UI**

Render two mutually exclusive options `PIN` / `Mot de passe`, one secure credential field, and one `Se connecter` action. Do not render TOTP, QR code, factor enrollment, or second-verification screens.

- [ ] **Step 4: Run complete Android verification**

```bash
./gradlew :app-native:testDebugUnitTest :app-native:lintDebug :app-native:assembleDebug
```

Expected: PASS and APK produced.

- [ ] **Step 5: Commit**

```bash
git add app-native
git commit -m "feat(android): simplify login UI"
```

## Completion Gate

- Web and Android offer PIN/password only.
- No MFA/TOTP/AAL2 application flow remains.
- Android JSON response-shape regression remains green.
- Android stays native and online-only.
- Both clients consume the same backend session/error contract.
