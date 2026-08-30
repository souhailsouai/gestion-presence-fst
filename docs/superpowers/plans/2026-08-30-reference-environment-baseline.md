# Reference, Environment, and Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Freeze the approved HTML reference, generate a traceable parity inventory, pin database tooling, and capture a redacted Supabase baseline before changing the backend or Android runtime.

**Architecture:** The repository stores one immutable HTML reference with a recorded SHA-256 digest. Deterministic Python scripts regenerate the HTML workflow inventory and parity matrix. Supabase commands run staging-first through an environment guard; production mutation requires an explicit operator override.

**Tech Stack:** Python 3.12, Node.js 22, Supabase CLI 2.116.0, PostgreSQL 17 client, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-30-native-android-supabase-design.md`

## Global Constraints

- Production Supabase project ref: `dbslzmvzbxczpqyektpx`.
- Staging Supabase project ref: `llxgpdaasdlnmonxqysw`.
- Approved source HTML: `gestion_presence_tp_theme_institutionnel.html`.
- Approved reference filename: `Gestion-Presence-FST-HTML-Final-2026-2027.html`.
- Approved reference timestamp: `2026-08-30T09:36:40Z`.
- Do not commit database rows, auth users, email addresses, usernames, PIN hashes, JWTs, API keys, or connection strings.
- Existing Web, Windows, and Android WebView releases remain operational throughout this plan.
- Generated artifacts must be deterministic and reproducible.
- This plan must not modify production schema, policies, Edge Functions, or application runtime behavior.

---

### Task 1: Freeze and verify the approved HTML

**Files:**
- Create: `reference/Gestion-Presence-FST-HTML-Final-2026-2027.html`
- Create: `reference/reference.json`
- Create: `scripts/freeze_reference.py`
- Create: `scripts/verify_reference.py`
- Create: `tests/reference/__init__.py`
- Test: `tests/reference/test_reference.py`

**Interfaces:**
- Consumes: `gestion_presence_tp_theme_institutionnel.html`.
- Produces: `freeze(source: Path, target: Path, metadata: Path) -> dict[str, str]`.
- Produces: `verify(root: Path) -> list[str]`; an empty list means success.

- [ ] **Step 1: Write the failing test**

```python
from __future__ import annotations

import hashlib
import json
import unittest
from pathlib import Path

from scripts.verify_reference import verify

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "gestion_presence_tp_theme_institutionnel.html"
TARGET = ROOT / "reference/Gestion-Presence-FST-HTML-Final-2026-2027.html"
METADATA = ROOT / "reference/reference.json"


class ReferenceTest(unittest.TestCase):
    def test_reference_is_byte_identical_and_digest_is_recorded(self) -> None:
        self.assertEqual(SOURCE.read_bytes(), TARGET.read_bytes())
        record = json.loads(METADATA.read_text(encoding="utf-8"))
        self.assertEqual(hashlib.sha256(TARGET.read_bytes()).hexdigest(), record["sha256"])
        self.assertEqual("2026-08-30T09:36:40Z", record["approved_created_at_utc"])

    def test_verifier_reports_no_drift(self) -> None:
        self.assertEqual([], verify(ROOT))


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the test and verify the expected failure**

Run:

```bash
python -m unittest tests.reference.test_reference -v
```

Expected: failure because the frozen HTML and metadata do not exist.

- [ ] **Step 3: Implement deterministic freezing and verification**

```python
# scripts/freeze_reference.py
from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "gestion_presence_tp_theme_institutionnel.html"
TARGET = ROOT / "reference/Gestion-Presence-FST-HTML-Final-2026-2027.html"
METADATA = ROOT / "reference/reference.json"


def freeze(source: Path, target: Path, metadata: Path) -> dict[str, str]:
    payload = source.read_bytes()
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(payload)
    record = {
        "file": target.name,
        "source": source.name,
        "sha256": hashlib.sha256(payload).hexdigest(),
        "approved_created_at_utc": "2026-08-30T09:36:40Z",
        "status": "approved",
    }
    metadata.write_text(
        json.dumps(record, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    return record


if __name__ == "__main__":
    freeze(SOURCE, TARGET, METADATA)
```

```python
# scripts/verify_reference.py
from __future__ import annotations

import hashlib
import json
from pathlib import Path


def verify(root: Path) -> list[str]:
    source = root / "gestion_presence_tp_theme_institutionnel.html"
    target = root / "reference/Gestion-Presence-FST-HTML-Final-2026-2027.html"
    metadata = root / "reference/reference.json"
    missing = [path for path in (source, target, metadata) if not path.is_file()]
    if missing:
        return [f"missing: {path}" for path in missing]
    source_bytes = source.read_bytes()
    target_bytes = target.read_bytes()
    record = json.loads(metadata.read_text(encoding="utf-8"))
    errors: list[str] = []
    if source_bytes != target_bytes:
        errors.append("canonical HTML and approved reference differ")
    if record.get("sha256") != hashlib.sha256(target_bytes).hexdigest():
        errors.append("reference SHA-256 mismatch")
    if record.get("status") != "approved":
        errors.append("reference status is not approved")
    return errors


if __name__ == "__main__":
    problems = verify(Path(__file__).resolve().parents[1])
    if problems:
        raise SystemExit("\n".join(problems))
```

Run:

```bash
python scripts/freeze_reference.py
```

- [ ] **Step 4: Verify the implementation**

Run:

```bash
python -m unittest tests.reference.test_reference -v
python scripts/verify_reference.py
```

Expected: both commands exit with status 0.

- [ ] **Step 5: Commit**

```bash
git add reference scripts/freeze_reference.py scripts/verify_reference.py tests/reference
git commit -m "chore: freeze approved HTML reference"
```

---

### Task 2: Generate the HTML workflow inventory and parity matrix

**Files:**
- Create: `scripts/extract_html_parity.py`
- Test: `tests/reference/test_parity_inventory.py`
- Generate: `docs/parity/html-workflows.json`
- Generate: `docs/parity/parity-matrix.csv`

**Interfaces:**
- Consumes: frozen HTML from Task 1.
- Produces: `extract(html: str) -> dict[str, object]`.
- Produces CSV columns: `workflow_id,html_label,html_element_id,html_handler,web,windows,android,backend_contract,automated_test,status`.

- [ ] **Step 1: Write the failing inventory test**

```python
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INVENTORY = ROOT / "docs/parity/html-workflows.json"
MATRIX = ROOT / "docs/parity/parity-matrix.csv"


class ParityInventoryTest(unittest.TestCase):
    def test_reference_tabs_and_critical_actions_are_present(self) -> None:
        payload = json.loads(INVENTORY.read_text(encoding="utf-8"))
        self.assertEqual(
            {"dashboard", "classes", "emploi", "etudiants", "seances", "presence", "rapports", "administration"},
            {item["id"] for item in payload["tabs"]},
        )
        self.assertTrue(
            {"addClass", "addStudent", "createSession", "loadPresenceSheet", "generateReport", "adminCreateTeacher", "adminExportAll", "adminImportAll"}.issubset(set(payload["handlers"]))
        )
        self.assertEqual(len(payload["workflows"]), len(MATRIX.read_text(encoding="utf-8").splitlines()) - 1)
```

- [ ] **Step 2: Run the test and verify the expected failure**

```bash
python -m unittest tests.reference.test_parity_inventory -v
```

Expected: failure because the generated files do not exist.

- [ ] **Step 3: Implement deterministic extraction**

```python
from __future__ import annotations

import csv
import json
import re
from html import unescape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REFERENCE = ROOT / "reference/Gestion-Presence-FST-HTML-Final-2026-2027.html"
INVENTORY = ROOT / "docs/parity/html-workflows.json"
MATRIX = ROOT / "docs/parity/parity-matrix.csv"
TAB = re.compile(r'<button[^>]*class="nav-tab[^"]*"[^>]*onclick="switchTab\(\'([^\']+)\'\)"[^>]*>(.*?)</button>', re.I | re.S)
HANDLER = re.compile(r'\bon(?:click|change|submit)="([A-Za-z_$][\w$]*)\s*\(')
TAG = re.compile(r"<[^>]+>")


def label(fragment: str) -> str:
    return " ".join(unescape(TAG.sub(" ", fragment)).split())


def extract(html: str) -> dict[str, object]:
    tabs = [{"id": item_id, "label": label(text)} for item_id, text in TAB.findall(html)]
    handlers = sorted(set(HANDLER.findall(html)))
    workflows = [
        {"workflow_id": f"tab.{item['id']}", "html_label": item["label"], "html_element_id": item["id"], "html_handler": f"switchTab:{item['id']}"}
        for item in tabs
    ] + [
        {"workflow_id": f"action.{name}", "html_label": name, "html_element_id": "", "html_handler": name}
        for name in handlers
    ]
    workflows.sort(key=lambda item: item["workflow_id"])
    return {"reference": REFERENCE.name, "tabs": tabs, "handlers": handlers, "workflows": workflows}


def write_outputs(payload: dict[str, object]) -> None:
    INVENTORY.parent.mkdir(parents=True, exist_ok=True)
    INVENTORY.write_text(json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    columns = ["workflow_id", "html_label", "html_element_id", "html_handler", "web", "windows", "android", "backend_contract", "automated_test", "status"]
    with MATRIX.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=columns)
        writer.writeheader()
        for workflow in payload["workflows"]:
            writer.writerow({**workflow, "web": "reference", "windows": "reference", "android": "not_started", "backend_contract": "not_mapped", "automated_test": "not_mapped", "status": "inventory"})


if __name__ == "__main__":
    write_outputs(extract(REFERENCE.read_text(encoding="utf-8")))
```

- [ ] **Step 4: Generate twice and prove determinism**

```bash
python scripts/extract_html_parity.py
python -m unittest tests.reference.test_parity_inventory -v
cp docs/parity/html-workflows.json /tmp/html-workflows.json
cp docs/parity/parity-matrix.csv /tmp/parity-matrix.csv
python scripts/extract_html_parity.py
cmp /tmp/html-workflows.json docs/parity/html-workflows.json
cmp /tmp/parity-matrix.csv docs/parity/parity-matrix.csv
```

Expected: tests pass and both `cmp` commands exit with status 0.

- [ ] **Step 5: Commit**

```bash
git add scripts/extract_html_parity.py tests/reference/test_parity_inventory.py docs/parity
git commit -m "docs: generate HTML parity inventory"
```

---

### Task 3: Pin Supabase tooling and guard production

**Files:**
- Create: `package.json`
- Generate: `package-lock.json`
- Create: `.env.example`
- Create: `scripts/guard_environment.sh`
- Create: `tests/environment/__init__.py`
- Test: `tests/environment/test_guard_environment.py`
- Create through CLI: `supabase/config.toml`

**Interfaces:**
- Reads `SUPABASE_PROJECT_REF`, `SUPABASE_PRODUCTION_PROJECT_REF`, and `ALLOW_PRODUCTION`.
- Rejects production mutation unless `ALLOW_PRODUCTION=true`.

- [ ] **Step 1: Write the guard tests**

```python
import os
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts/guard_environment.sh"


class EnvironmentGuardTest(unittest.TestCase):
    def run_guard(self, project_ref: str, allow: str = "false") -> subprocess.CompletedProcess[str]:
        env = {
            **os.environ,
            "SUPABASE_PROJECT_REF": project_ref,
            "SUPABASE_PRODUCTION_PROJECT_REF": "dbslzmvzbxczpqyektpx",
            "ALLOW_PRODUCTION": allow,
        }
        return subprocess.run(["bash", str(SCRIPT)], cwd=ROOT, env=env, text=True, capture_output=True, check=False)

    def test_staging_is_allowed(self) -> None:
        self.assertEqual(0, self.run_guard("llxgpdaasdlnmonxqysw").returncode)

    def test_production_is_rejected_by_default(self) -> None:
        result = self.run_guard("dbslzmvzbxczpqyektpx")
        self.assertNotEqual(0, result.returncode)
        self.assertIn("production mutation rejected", result.stderr)

    def test_production_requires_explicit_override(self) -> None:
        self.assertEqual(0, self.run_guard("dbslzmvzbxczpqyektpx", "true").returncode)
```

- [ ] **Step 2: Run the tests and verify the expected failure**

```bash
python -m unittest tests.environment.test_guard_environment -v
```

Expected: failure because the guard script does not exist.

- [ ] **Step 3: Add pinned CLI configuration and the guard**

```json
{
  "name": "gestion-presence-fst-tooling",
  "private": true,
  "engines": {"node": "22.x"},
  "scripts": {"supabase": "supabase", "supabase:version": "supabase --version"},
  "devDependencies": {"supabase": "2.116.0"}
}
```

```dotenv
SUPABASE_PRODUCTION_PROJECT_REF=dbslzmvzbxczpqyektpx
SUPABASE_STAGING_PROJECT_REF=llxgpdaasdlnmonxqysw
SUPABASE_PROJECT_REF=llxgpdaasdlnmonxqysw
ALLOW_PRODUCTION=false
SUPABASE_DB_URL=
```

```bash
#!/usr/bin/env bash
set -eu
: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF is required}"
: "${SUPABASE_PRODUCTION_PROJECT_REF:?SUPABASE_PRODUCTION_PROJECT_REF is required}"
if [ "$SUPABASE_PROJECT_REF" = "$SUPABASE_PRODUCTION_PROJECT_REF" ] && [ "${ALLOW_PRODUCTION:-false}" != "true" ]; then
  printf '%s\n' 'production mutation rejected: set ALLOW_PRODUCTION=true deliberately' >&2
  exit 64
fi
printf '%s\n' "environment accepted: $SUPABASE_PROJECT_REF"
```

Run:

```bash
chmod +x scripts/guard_environment.sh
npm install --package-lock-only
npx supabase init
```

- [ ] **Step 4: Verify pinned tooling and guard behavior**

```bash
npm ci
npm run supabase:version
python -m unittest tests.environment.test_guard_environment -v
```

Expected Supabase CLI version: `2.116.0` and all tests pass.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .env.example scripts/guard_environment.sh tests/environment supabase/config.toml
git commit -m "build: pin Supabase tooling and guard production"
```

---

### Task 4: Capture a metadata-only Supabase baseline

**Files:**
- Create: `supabase/baseline/schema_inventory.sql`
- Create: `supabase/baseline/security_inventory.sql`
- Create: `scripts/capture_database_baseline.sh`
- Create: `scripts/verify_baseline_redaction.py`
- Test: `tests/environment/test_baseline_redaction.py`
- Generate: `docs/baseline/production-schema.tsv`
- Generate: `docs/baseline/production-security.tsv`

**Interfaces:**
- Reads a read-only `SUPABASE_DB_URL` supplied outside Git.
- Writes only object metadata, constraints, policies, and function signatures.

- [ ] **Step 1: Write the redaction test**

```python
import unittest
from pathlib import Path

from scripts.verify_baseline_redaction import verify_files

ROOT = Path(__file__).resolve().parents[2]


class BaselineRedactionTest(unittest.TestCase):
    def test_committed_baseline_contains_no_secret_or_personal_value(self) -> None:
        paths = sorted((ROOT / "docs/baseline").glob("*.tsv"))
        self.assertEqual(2, len(paths))
        self.assertEqual([], verify_files(paths))
```

- [ ] **Step 2: Run the test and verify the expected failure**

```bash
python -m unittest tests.environment.test_baseline_redaction -v
```

Expected: failure because no baseline files exist.

- [ ] **Step 3: Add metadata queries and the redaction verifier**

```sql
-- supabase/baseline/schema_inventory.sql
\pset format unaligned
\pset fieldsep '\t'
select n.nspname as schema_name, c.relname as object_name, c.relkind as object_kind,
       c.relrowsecurity as rls_enabled,
       coalesce(string_agg(con.conname || ':' || pg_get_constraintdef(con.oid, true), E'\n' order by con.conname), '') as constraints
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_constraint con on con.conrelid = c.oid
where n.nspname in ('public', 'private') and c.relkind in ('r', 'v', 'm')
group by n.nspname, c.relname, c.relkind, c.relrowsecurity
order by n.nspname, c.relname;
```

```sql
-- supabase/baseline/security_inventory.sql
\pset format unaligned
\pset fieldsep '\t'
select 'policy', schemaname, tablename, policyname,
       cmd || ' roles=' || array_to_string(roles, ',') || ' using=' || coalesce(qual, '') || ' check=' || coalesce(with_check, '')
from pg_policies where schemaname in ('public', 'private')
union all
select 'function', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid),
       'security_definer=' || p.prosecdef::text || ' result=' || pg_get_function_result(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public', 'private')
order by 1, 2, 3, 4;
```

```python
# scripts/verify_baseline_redaction.py
from __future__ import annotations

import re
import sys
from pathlib import Path

PATTERNS = (
    re.compile(r"sb_(?:publishable|secret)_[A-Za-z0-9_-]+"),
    re.compile(r"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+"),
    re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"),
)


def verify_files(paths: list[Path]) -> list[str]:
    errors: list[str] = []
    for path in paths:
        text = path.read_text(encoding="utf-8")
        for pattern in PATTERNS:
            if pattern.search(text):
                errors.append(f"sensitive pattern in {path}: {pattern.pattern}")
    return errors


if __name__ == "__main__":
    errors = verify_files([Path(value) for value in sys.argv[1:]])
    if errors:
        raise SystemExit("\n".join(errors))
```

```bash
#!/usr/bin/env bash
# scripts/capture_database_baseline.sh
set -eu
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is required}"
mkdir -p docs/baseline
psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/baseline/schema_inventory.sql > docs/baseline/production-schema.tsv
psql "$SUPABASE_DB_URL" -X -v ON_ERROR_STOP=1 -f supabase/baseline/security_inventory.sql > docs/baseline/production-security.tsv
python scripts/verify_baseline_redaction.py docs/baseline/production-schema.tsv docs/baseline/production-security.tsv
```

- [ ] **Step 4: Capture and verify**

```bash
chmod +x scripts/capture_database_baseline.sh
SUPABASE_DB_URL="$SUPABASE_DB_URL" scripts/capture_database_baseline.sh
python -m unittest tests.environment.test_baseline_redaction -v
grep -F $'public\tprofiles' docs/baseline/production-schema.tsv
grep -F $'public\tclasses' docs/baseline/production-schema.tsv
grep -F $'public\tstudents' docs/baseline/production-schema.tsv
grep -F $'public\tsessions' docs/baseline/production-schema.tsv
grep -F $'public\tattendance' docs/baseline/production-schema.tsv
```

Expected: all commands exit with status 0 and the five existing public tables are present.

- [ ] **Step 5: Commit only the redacted metadata**

```bash
git add supabase/baseline scripts/capture_database_baseline.sh scripts/verify_baseline_redaction.py tests/environment/test_baseline_redaction.py docs/baseline
git commit -m "docs: capture redacted Supabase baseline"
```

---

### Task 5: Add reference and baseline verification to CI

**Files:**
- Create: `.github/workflows/reference-baseline.yml`
- Modify: `.github/workflows/build-apk.yml`

**Interfaces:**
- Produces required CI job `reference-baseline`.

- [ ] **Step 1: Run the intended CI commands locally**

```bash
python -m unittest discover -s tests -p 'test_*.py' -v
python scripts/verify_reference.py
python scripts/extract_html_parity.py
git diff --exit-code -- reference docs/parity docs/baseline
```

Expected: the final command fails until generated artifacts are committed and stable.

- [ ] **Step 2: Create the workflow**

```yaml
name: Reference and Baseline

on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

jobs:
  reference-baseline:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      - name: Verify reference, parity, and baseline
        run: |
          python -m unittest discover -s tests -p 'test_*.py' -v
          python scripts/verify_reference.py
          python scripts/extract_html_parity.py
          git diff --exit-code -- reference docs/parity docs/baseline
```

- [ ] **Step 3: Keep the current APK workflow active and add a compatibility note**

Add immediately above the existing embedded-HTML check in `.github/workflows/build-apk.yml`:

```yaml
      # Retain until the native Android cutover plan verifies and removes the production WebView.
```

- [ ] **Step 4: Run the complete local gate**

```bash
python -m unittest discover -s tests -p 'test_*.py' -v
python scripts/verify_reference.py
python scripts/extract_html_parity.py
git diff --exit-code -- reference docs/parity docs/baseline
```

Expected: all commands exit with status 0 and no generated diff remains.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/reference-baseline.yml .github/workflows/build-apk.yml
git commit -m "ci: verify approved reference and baseline"
```

---

## Completion Gate

- Frozen HTML is byte-identical to the approved source and its SHA-256 matches `reference.json`.
- Parity outputs regenerate without a diff and include all eight reference tabs and the critical actions.
- Supabase CLI 2.116.0 is pinned by `package-lock.json`.
- Production mutation is rejected without an explicit override.
- Baseline files contain metadata only and pass redaction tests.
- CI verifies reference, parity, and baseline artifacts.
- No production schema, policy, Edge Function, row, or application runtime behavior changes in this plan.
