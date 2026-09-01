# Web Time, Separate Student Lists, and Robust Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver one corrected standalone Web HTML that enforces canonical 24-hour time, renders one independent student list per class with colored groups and group reassignment, and correctly imports CSV/XLS/XLSX without Unicode escape failures.

**Architecture:** Keep Supabase schema and RLS unchanged. Add focused Web helpers for time normalization, student-list rendering/group reassignment, and spreadsheet parsing; wire them into the existing standalone build so the final HTML remains self-contained and preserves the already-correct attendance/grade behavior.

**Tech Stack:** HTML/CSS/JavaScript, Supabase JS, Node.js test suite (`node:test`), Python build scripts already present in the repository, bundled SheetJS-compatible parser for Excel if existing dependencies permit vendoring.

**Spec:** `docs/superpowers/specs/2026-09-01-web-time-students-import-design.md`

## Global Constraints

- Web application only.
- No Windows changes.
- No Android changes.
- No Supabase schema migration.
- No change to attendance authorization rules.
- Every class must render as a visually independent student list/block.
- Groups are nested only inside their owning class list and use deterministic visual styling.
- The final deliverable remains one standalone HTML file.

---

### Task 1: Canonical 24-hour time helpers

**Files:**
- Create: `web/time-format.js`
- Modify: `scripts/build_single_file_release.py`
- Test: `tests/web/time-format.test.cjs`

**Interfaces:**
- Produces: `window.FSTTime.format(value) -> string`, `window.FSTTime.normalize(value) -> string|null`, `window.FSTTime.isValid(value) -> boolean`.
- Later tasks use these helpers for rendering and persistence.

- [ ] **Step 1: Write failing tests** for `00:00`, `07:05`, `13:45`, `23:59`, normalization of `7:30` to `07:30`, and rejection of `24:00`, `25:10`, `13:72`, malformed strings.
- [ ] **Step 2: Run** `node --test tests/web/time-format.test.cjs` and verify RED because `web/time-format.js` does not yet exist.
- [ ] **Step 3: Implement** a small IIFE exporting `window.FSTTime`; accept canonical strings and user-entered `H:MM`/`HH:MM`, normalize to two digits, reject out-of-range values, and format Supabase `HH:MM:SS` values to `HH:MM` only after validation.
- [ ] **Step 4: Add `web/time-format.js` to the standalone inlining order** before modules that render classes/sessions.
- [ ] **Step 5: Run** the dedicated test and the full Web tests; verify GREEN.
- [ ] **Step 6: Commit** with message `feat: enforce canonical 24-hour web time`.

### Task 2: Apply canonical time formatting to the Web UI

**Files:**
- Modify: existing Web rendering modules containing class/session/timetable/report time output, identified by searching for `.start`, `.end`, `start_time`, `end_time`, and `type="time"`.
- Test: `tests/web/time-rendering.test.cjs`

**Interfaces:**
- Consumes: `window.FSTTime.format`, `window.FSTTime.normalize`.
- Produces: all rendered time text and persisted editable time values in canonical `HH:MM`.

- [ ] **Step 1: Write failing contract tests** asserting rendered-time code routes values through `FSTTime.format` and persistence routes editable values through `FSTTime.normalize` before writes.
- [ ] **Step 2: Run** `node --test tests/web/time-rendering.test.cjs` and verify RED.
- [ ] **Step 3: Replace direct time slicing/raw output** with `FSTTime.format(...)`; normalize form values before class/session writes and show an explicit validation message when invalid.
- [ ] **Step 4: Keep native time inputs where already present**, but ensure displayed text never depends on browser locale presentation.
- [ ] **Step 5: Run** dedicated tests plus full Web suite.
- [ ] **Step 6: Commit** with message `fix: render and persist web times in 24-hour format`.

### Task 3: Separate student list per class

**Files:**
- Create: `web/student-management.js`
- Modify: `scripts/build_single_file_release.py`
- Modify: canonical base HTML only if a dedicated container hook is required.
- Test: `tests/web/student-management.test.cjs`

**Interfaces:**
- Produces: `window.renderStudents()` override or equivalent existing hook, `window.FSTStudentManagement.classKey(cls)`, `window.FSTStudentManagement.groupStyle(groupNumber)`.
- Consumes: global authoritative `data.classes` and `data.students` already loaded from Supabase.

- [ ] **Step 1: Write failing tests** requiring one independent class block/list per concrete class label, with its own header, and ensuring students from two different classes can never share a rendered list container.
- [ ] **Step 2: Add failing tests** requiring group subsections to appear only inside their owning class block and deterministic group style classes such as `student-group-1`, `student-group-2`, `student-group-3`.
- [ ] **Step 3: Run** `node --test tests/web/student-management.test.cjs` and verify RED.
- [ ] **Step 4: Implement grouped rendering**: iterate concrete class records, create a separate class card/list for each, filter students strictly by that class/group mapping, sort groups and students deterministically, and render each group as a nested colored subsection.
- [ ] **Step 5: Add institutional-theme CSS** for class blocks and group variants with readable contrast and no random colors.
- [ ] **Step 6: Inline `web/student-management.js` after the legacy/base student renderer** so the modular implementation is authoritative in the final standalone HTML.
- [ ] **Step 7: Run** dedicated and full tests.
- [ ] **Step 8: Commit** with message `feat: render separate student list for every class`.

### Task 4: Change a student's group inside the same class

**Files:**
- Modify: `web/student-management.js`
- Test: `tests/web/student-group-change.test.cjs`

**Interfaces:**
- Produces: `window.changeStudentGroup(studentId, targetClassId) -> Promise<boolean>`.
- Consumes: authorized `data.classes`, `data.students`, `supabaseClient`, and authoritative refresh helper.

- [ ] **Step 1: Write failing tests** asserting the selector only lists compatible target groups belonging to the same visual class family and excludes unrelated classes.
- [ ] **Step 2: Write failing tests** asserting the update payload is exactly `{class_id: targetClassId}` for the selected student and that authoritative state is refreshed after success.
- [ ] **Step 3: Run** `node --test tests/web/student-group-change.test.cjs` and verify RED.
- [ ] **Step 4: Implement compatibility filtering** using the existing track/class metadata plus the concrete visual class identity defined in the spec; never expose cross-class targets.
- [ ] **Step 5: Implement Supabase update** on `students` by student id, rely on RLS, refresh authoritative data, re-render the class lists, and restore the previous UI selection on failure.
- [ ] **Step 6: Add explicit success/error alerts** without exposing raw database internals as the only user-facing message.
- [ ] **Step 7: Run** dedicated and full tests.
- [ ] **Step 8: Commit** with message `feat: allow web student group reassignment`.

### Task 5: Robust CSV parser and Unicode sanitization

**Files:**
- Create: `web/student-import.js`
- Modify: `web/online-fixes.js`
- Modify: `scripts/build_single_file_release.py`
- Test: `tests/web/student-import-csv.test.cjs`

**Interfaces:**
- Produces: `window.FSTStudentImport.parseCsv(arrayBuffer) -> {rows,rejected}`, `sanitizeCell(value) -> string`, `normalizeHeaders(headers) -> object`.
- Later Excel parsing feeds the same normalized row model.

- [ ] **Step 1: Write failing tests** for UTF-8 accents, UTF-8 BOM, semicolon delimiter, comma delimiter, tab delimiter, quoted delimiters, escaped quotes, Windows-1252 fallback, NUL removal, and forbidden control-character sanitization.
- [ ] **Step 2: Run** `node --test tests/web/student-import-csv.test.cjs` and verify RED.
- [ ] **Step 3: Implement ArrayBuffer decoding** with fatal UTF-8 first and Windows-1252 fallback; strip BOM after decoding.
- [ ] **Step 4: Implement a standards-aware CSV state machine** that supports quoted fields and delimiter detection instead of `split(/[,;]/)`.
- [ ] **Step 5: Normalize headers** for `Nom`, `Prénom`, `Email`, `Classe`, `Groupe`, including common case/accent variants.
- [ ] **Step 6: Sanitize all cell values** by removing NUL and disallowed controls while preserving valid Unicode letters and accents.
- [ ] **Step 7: Refactor `web/online-fixes.js`** so `handleFile` dispatches by extension/MIME and never calls `readAsText()` for spreadsheet imports.
- [ ] **Step 8: Run** dedicated/full tests.
- [ ] **Step 9: Commit** with message `fix: make web csv import unicode safe`.

### Task 6: Real XLSX/XLS import

**Files:**
- Add or vendor: a browser spreadsheet parser asset under `web/vendor/` if not already present.
- Modify: `web/student-import.js`
- Modify: `scripts/build_single_file_release.py`
- Test: `tests/web/student-import-excel.test.cjs`
- Add fixtures: `tests/fixtures/students.xlsx` and `tests/fixtures/students.xls` only if the selected parser supports both formats.

**Interfaces:**
- Produces: `window.FSTStudentImport.parseExcel(arrayBuffer) -> {rows,rejected}`.
- Consumes: same normalized row schema as CSV.

- [ ] **Step 1: Verify repository dependency policy and parser availability**; prefer an already-used or vendorable browser-safe SheetJS build, with no runtime CDN dependency in the final standalone artifact.
- [ ] **Step 2: Write failing tests** against a real `.xlsx` workbook containing accented names and explicit class/group columns; include `.xls` only if supported by the selected parser build.
- [ ] **Step 3: Run** the Excel-specific test and verify RED.
- [ ] **Step 4: Implement ArrayBuffer workbook parsing**, first worksheet selection, conversion to row arrays, and handoff to the same header normalization/sanitization pipeline used by CSV.
- [ ] **Step 5: Inline the parser dependency into the standalone build** and verify the final HTML has no external runtime requirement for spreadsheet parsing.
- [ ] **Step 6: Run** dedicated/full tests.
- [ ] **Step 7: Commit** with message `feat: support real excel student imports on web`.

### Task 7: Import row validation, class/group resolution, and persistence

**Files:**
- Modify: `web/student-import.js`
- Modify: `web/online-fixes.js`
- Test: `tests/web/student-import-persistence.test.cjs`

**Interfaces:**
- Produces: `validateRows(rows, classes) -> {valid,rejected}`, `persistImport(valid) -> Promise<ImportSummary>`.
- Consumes: normalized rows from CSV/Excel and existing Supabase class/student mapping functions.

- [ ] **Step 1: Write failing tests** for `Nom | Prénom | Email | Classe | Groupe`, optional Email/Groupe, legacy `MPI1-G2` class labels, unknown-group rejection, row-numbered rejection reasons, and duplicate/empty-name handling consistent with existing app rules.
- [ ] **Step 2: Write failing test** proving no DB write happens until the complete file has been parsed and validated.
- [ ] **Step 3: Run** persistence tests and verify RED.
- [ ] **Step 4: Implement class/group resolution** against authorized `data.classes`; do not silently map an unknown explicit group to another group.
- [ ] **Step 5: Persist sanitized class/student rows** using existing Supabase upsert conventions, relying on RLS.
- [ ] **Step 6: Refresh authoritative state** after success and show summary such as `48 étudiants importés, 2 lignes rejetées` with accessible rejection details.
- [ ] **Step 7: Ensure valid imports cannot surface `unsupported Unicode escape sequence`** by eliminating binary-as-text reads and NUL/control payloads.
- [ ] **Step 8: Run** dedicated/full tests.
- [ ] **Step 9: Commit** with message `fix: validate and persist web student imports safely`.

### Task 8: Regression, standalone build, and final artifact

**Files:**
- Test: existing `tests/web/*.test.cjs`
- Build: existing `scripts/build_online_web.py`, `scripts/build_single_file_release.py`
- Output: final standalone HTML artifact

**Interfaces:**
- Consumes: all previous tasks.
- Produces: one validated standalone Web HTML file.

- [ ] **Step 1: Run all Web tests** with the repository's existing Node test command and confirm attendance/session/grade regression tests remain GREEN.
- [ ] **Step 2: Run JavaScript syntax checks** used by CI.
- [ ] **Step 3: Run the online Web build** and verify no Windows or Android file changes are required.
- [ ] **Step 4: Run standalone build** and verify the output contains the time helper, separate-class student renderer, group reassignment logic, CSV parser, and bundled Excel parser.
- [ ] **Step 5: Inspect final HTML contracts** for: `HH:MM` helper, class-block markup/styles, group selector, ArrayBuffer import path, no Excel `readAsText()`, and preserved attendance/grade modules.
- [ ] **Step 6: Run CI/build workflow** and require all verification steps to pass.
- [ ] **Step 7: Compute SHA-256** for the delivered HTML.
- [ ] **Step 8: Commit final integration changes** with message `release: web student management and import improvements` if any build metadata changes remain.
