# Cross-Platform V2 Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify, publish, and deliver synchronized Web, Windows, Android, and Supabase V2 releases from one immutable commit.

**Architecture:** One release branch and one tagged commit own the source of all clients and database migrations. CI validates parity, security, schema compatibility, and builds every artifact. Production migration occurs only after staging and client build gates pass. Release artifacts include checksums, SBOM/dependency manifests, and exact commit provenance.

**Tech Stack:** GitHub Actions, Supabase hosted projects, Node.js, .NET 8, Android/Gradle, SHA-256, GitHub Releases/Pages.

**Spec:** `docs/superpowers/specs/2026-08-30-native-android-supabase-design.md`

## Global Constraints

- Release branch: `release/final-cross-platform-2026-2027`.
- Production changes must match committed migration/function source exactly.
- Web, Windows, and Android report the same schema version and release version.
- Never publish a client that embeds a secret/service-role key.
- Do not merge to `main` until every required workflow is green.
- Do not call a build final until the actual downloadable artifact is inspected.

---

### Task 1: Create the unified verification workflow

**Files:**
- Create: `.github/workflows/verify-release-v2.yml`
- Create: `scripts/verify_release_contract.py`
- Create: `tests/release/test_release_contract.py`

**Interfaces:**
- Validates frozen HTML checksum, parity matrix, migration ordering, client version agreement, forbidden strings/dependencies, and required workflow files.

- [ ] Write failing contract tests.
- [ ] Implement deterministic verifier.
- [ ] Run it locally/CI and commit.

### Task 2: Run staging end-to-end tests

**Files:**
- Create: `tests/e2e/scenarios.md`
- Create: `docs/releases/2026-08-30-staging-e2e.md`

**Interfaces:**
- Scenarios cover teacher A, teacher B, administrator, MFA enrollment/challenge, class/student/session lifecycle, attendance save, conflict, idempotent replay, reports, admin audit, network interruption, and session revocation.

- [ ] Create non-production test identities and fixtures.
- [ ] Execute backend and client integration tests against staging.
- [ ] Record exact pass/fail evidence without credentials or personal data.
- [ ] Remove or disable staging fixture accounts after verification.
- [ ] Commit report.

### Task 3: Build release candidates

**Files:**
- Create: `.github/workflows/build-release-candidates.yml`
- Create: `docs/releases/2026-08-30-release-candidates.md`

**Interfaces:**
- Produces Web ZIP/single HTML, Windows portable ZIP/installer, Android APK/AAB, checksum manifest, and dependency manifests from the same commit.

- [ ] Build all clients from the release SHA.
- [ ] Inspect archive contents, versions, signatures, and forbidden strings.
- [ ] Install Windows candidate on a clean Windows runner and Android candidate on an emulator.
- [ ] Open the hosted Web candidate and run smoke navigation/auth tests.
- [ ] Record workflow/run/artifact IDs and checksums.
- [ ] Commit report.

### Task 4: Migrate production and run smoke verification

**Files:**
- Update: `docs/releases/2026-08-30-production-rollout.md`.

**Interfaces:**
- Production database and Edge Function versions exactly match the release commit.

- [ ] Capture pre-migration counts and metadata-only backup evidence.
- [ ] Apply committed migrations in order and deploy committed Edge Functions.
- [ ] Verify row counts, RLS isolation, RPCs, MFA, and advisors.
- [ ] Deploy hosted Web candidate.
- [ ] Run production smoke tests with designated non-destructive accounts.
- [ ] Record rollback decision point and evidence.
- [ ] Commit report.

### Task 5: Publish final artifacts and tag

**Files:**
- Create: `CHANGELOG-2026-2027.md`
- Create: `RELEASE-NOTES-2.0.0.md`

**Interfaces:**
- Tag: `v2.0.0-2026-2027`.
- Artifact names identify Web, Windows x64, Setup x64, Android APK, and Android AAB.

- [ ] Re-run all required workflows on the exact tag candidate commit.
- [ ] Create signed/annotated tag and GitHub Release.
- [ ] Attach all artifacts and SHA-256 manifest.
- [ ] Merge release branch to `main` only after green checks and artifact inspection.
- [ ] Verify GitHub Pages/hosted Web points to the tagged content.
- [ ] Provide final user download links and installation notes.

## Completion Gate

- All required workflows are green on one immutable commit.
- Production migration and client artifacts match that commit.
- Web, Windows, and Android pass staging and production smoke tests.
- Final artifacts are downloadable, inspected, and accompanied by SHA-256 checksums.
- `main` and tag `v2.0.0-2026-2027` contain the release source.
