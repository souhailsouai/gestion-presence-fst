# V16 Exports, Timetable Integration and Release Regression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete V16 with filtered PDF/Excel planning exports, timetable→presence navigation, institutional headers, and full release/regression verification.

**Architecture:** Reuse the V16 pure filter state as the single source for both on-screen planning and exports. Keep export formatting in focused modules. Link timetable rows to presence by session id rather than duplicating attendance-loading logic.

**Tech Stack:** Vanilla JavaScript, existing PDF engine, spreadsheet export library already bundled/approved in the Web build, Node.js tests, Python build scripts.

**Spec:** `docs/superpowers/specs/2026-09-03-v16-planning-design.md`

## Global Constraints

- PDF and Excel export exactly the current filtered planning view.
- Institutional header includes FST, 2026/2027, semester, filter title and generation date.
- No TEST data appears in RÉEL exports/reports.
- Timetable click opens Présence with the correct real session selected.
- Standalone Web artifact remains self-contained for application code.

---

### Task 1: Define export view model

**Files:**
- Create: `web/v16-planning-export-model.js`
- Create: `tests/web/v16-planning-export-model.test.cjs`

**Interfaces:**
- Produces `buildPlanningExportModel(filteredState, meta) -> {title, subtitle, generatedAt, columns, rows, summary}`.

- [ ] Write failing tests for complete planning, class/group, teacher, week, room and manipulation filters.
- [ ] Run focused test and verify FAIL.
- [ ] Implement a pure export-model builder using the same filtered rows displayed by the UI.
- [ ] Re-run focused test and verify PASS.
- [ ] Commit `feat(v16): add planning export model`.

### Task 2: Generate institutional PDF

**Files:**
- Create: `web/v16-planning-pdf.js`
- Reuse: `web/report-pdf.js`
- Create: `tests/web/v16-planning-pdf.test.cjs`

**Interfaces:**
- Produces `V16PlanningPdf.generate(model)`.

- [ ] Write failing tests asserting institutional title/meta, expected columns, filtered row count and absence of TEST-only labels/data for RÉEL exports.
- [ ] Run focused test and verify FAIL.
- [ ] Implement PDF rendering through the existing bundled PDF mechanism; use pagination and repeat table header across pages.
- [ ] Re-run focused test and existing `tests/web/pdf-bundle.test.cjs tests/web/pdf-engine-smoke.test.cjs`.
- [ ] Commit `feat(v16): generate institutional planning pdf`.

### Task 3: Generate Excel `.xlsx`

**Files:**
- Create: `web/v16-planning-xlsx.js`
- Modify: `scripts/build_single_file_release.py` only if the current bundle does not already include the required spreadsheet writer.
- Create: `tests/web/v16-planning-xlsx.test.cjs`

**Interfaces:**
- Produces `V16PlanningXlsx.generate(model)`.

- [ ] Write failing tests asserting worksheet name, institutional metadata rows, planning headers, exact filtered row count and usable date/time string values.
- [ ] Run focused test and verify FAIL.
- [ ] Implement workbook generation using the already-approved/bundled spreadsheet dependency; do not introduce a second spreadsheet library.
- [ ] Re-run focused test and build tests.
- [ ] Commit `feat(v16): generate planning xlsx`.

### Task 4: Add interactive Generate menu

**Files:**
- Modify: `web/v16-planning-ui.js`
- Create: `tests/web/v16-planning-generate-ui.test.cjs`

**Interfaces:**
- Consumes PDF/XLSX generators.

- [ ] Write failing UI tests for `Générer` → `PDF` / `Excel (.xlsx)`, disabled state while generating, success/error feedback and title based on current filters.
- [ ] Run focused test and verify FAIL.
- [ ] Implement controls; export must use the current in-memory filtered state without a different query path.
- [ ] Re-run focused test and verify PASS.
- [ ] Commit `feat(v16): add interactive planning exports`.

### Task 5: Link Emploi du temps directly to Présence

**Files:**
- Create or modify: `web/v16-timetable-presence-link.js`
- Modify minimal host/render integration in `gestion_presence_tp_theme_institutionnel.html` or the module that renders timetable rows.
- Create: `tests/web/v16-timetable-presence-link.test.cjs`

**Interfaces:**
- Produces `openPresenceForSession(sessionId)` that activates the Présence tab, selects the session and invokes the existing attendance render/load path.

- [ ] Write failing tests for a timetable-session action opening Présence and selecting the exact session id.
- [ ] Run focused test and verify FAIL.
- [ ] Implement using the existing attendance selector/loading API; do not duplicate student/attendance fetching.
- [ ] Re-run focused test and attendance tests.
- [ ] Commit `feat(v16): link timetable sessions to presence`.

### Task 6: Final V16 release verification

**Files:**
- Modify as needed: `scripts/build_online_web.py`, `scripts/build_single_file_release.py`
- Create: `tests/web/v16-release-contract.test.cjs`

- [ ] Write/extend release-contract test to assert V16 label, navigation order, native Planning tab, no floating V5.15 launcher, teacher-mode TEST absence, and bundled V16 modules.
- [ ] Run `node --test tests/web/*.test.cjs` and require zero failures.
- [ ] Run `python scripts/build_online_web.py` and verify success.
- [ ] Run `python scripts/build_single_file_release.py` and verify success.
- [ ] Inspect produced HTML for `Planning des séances`, `MODE TEST`, role gating hooks and absence of the old floating launcher.
- [ ] Record release notes in `releases/v16/REFERENCE.md` including base V5.13, official planning source, build artifact name and checksum generated during release execution.
- [ ] Commit `chore(v16): verify interactive release`.
