# Web-only design: 24-hour time, student grouping, and robust CSV/Excel import

Date: 2026-09-01
Scope: Web application only. This design applies to the corrected standalone Web application previously delivered. It does not modify Windows, Android, or the Supabase schema.

## 1. Goals

The Web application must:

1. Use a canonical 24-hour `HH:MM` format for all editable and displayed times.
2. Organize the student-management view by class, then by group, with visually distinct group styling.
3. Allow an authorized user to move a student between groups belonging to the same class family.
4. Correct the student import flow so real CSV and Excel files are parsed safely without Unicode escape failures.
5. Preserve the existing attendance/grade/session-closing behavior already corrected.

## 2. Explicit non-goals

- No Windows changes.
- No Android changes.
- No Supabase schema migration.
- No change to attendance authorization rules.
- No unrelated UI redesign.

## 3. Time handling

### Canonical representation

All times remain strings in canonical 24-hour `HH:MM` form.

Valid examples: `00:00`, `07:05`, `13:45`, `23:59`.
Invalid examples: `24:00`, `7:5`, `13:72`, `25:10`.

A Web helper will:

- normalize accepted user input to two-digit `HH:MM`;
- reject invalid hours/minutes before persistence;
- format Supabase time values by taking the first five characters only after validation;
- format all rendered session/class/timetable/report times with the same canonical helper.

Native `<input type="time">` may remain where practical for browser validation, but the application will not rely on locale-dependent browser presentation as the only formatting mechanism. Displayed text must always use the canonical formatter.

## 4. Student management: class and group hierarchy

### Existing data model

The current model is retained:

- each group is represented by a class record carrying `track`, `classNumber`, and `groupNumber`;
- each student belongs to one group through `class_id`.

No new group table is required.

### Visual organization

The `Gestion des Étudiants` list will be rendered as:

- one outer block per class family, identified primarily by `track + classNumber`;
- one subgroup section per `groupNumber` inside the class block;
- students listed inside their subgroup.

Groups receive deterministic visual variants based on their group number. Styling must remain readable in the existing institutional theme and must not depend on random colors.

### Moving a student between groups

Each student row will contain a `Groupe` selector listing only compatible group records from the same class family.

When the user changes the group:

1. validate access to the source and target group;
2. update only the student's `class_id` in Supabase;
3. refresh authoritative Web state from Supabase;
4. re-render the grouped student view;
5. show a success or explicit failure message.

A student cannot be moved to an unrelated track/class through this selector.

## 5. CSV and Excel import

### Current defect

The current online import accepts `.csv`, `.xlsx`, and `.xls`, but the implementation reads every file through `FileReader.readAsText()` and then splits text as CSV. Binary Excel workbooks therefore are not actually parsed as spreadsheets and can produce invalid Unicode/control characters during later processing or persistence.

### New import architecture

The import path will dispatch by file type:

#### CSV

- read as `ArrayBuffer` first;
- decode UTF-8 with BOM support;
- if UTF-8 decoding is invalid, fall back to Windows-1252;
- support comma, semicolon, and tab delimiters;
- support quoted fields and embedded delimiters;
- strip NUL and disallowed control characters;
- normalize headers case-insensitively and accent-insensitively where needed.

#### Excel (`.xlsx` / `.xls`)

- read as `ArrayBuffer`;
- use a real spreadsheet parser bundled with the standalone Web application;
- read the first worksheet by default;
- convert rows to the same normalized record structure used by CSV;
- never pass binary workbook content through `readAsText()`.

### Accepted columns

The importer accepts a normalized schema equivalent to:

`Nom | Prénom | Email | Classe | Groupe`

`Email` and `Groupe` may be optional. Existing files where the group is encoded directly in the class label, such as `MPI1-G2`, remain supported.

### Class/group resolution

For each normalized row:

- resolve an existing compatible group by class/group fields;
- if the row refers to an existing class family but an unknown group, report the row as invalid rather than silently attaching it to another group;
- retain compatibility with the current behavior for a simple class label when no explicit grouping metadata exists.

### Validation and persistence

The full file is parsed and validated before any write.

The result is split into:

- valid rows to import;
- rejected rows with row number and reason.

Writes occur only for sanitized records. Success feedback includes imported and rejected counts. No raw parser or database exception is exposed as the only user-facing message.

## 6. Security and authorization

Existing Supabase RLS remains authoritative.

The Web layer must:

- only present groups the current user is authorized to manage;
- never bypass RLS;
- sanitize imported text before database writes;
- reject unsupported file types and unreasonable file sizes;
- avoid dynamic code execution from spreadsheet content.

## 7. Files/modules expected to change

The implementation should stay within the Web build pipeline, primarily:

- `web/online-fixes.js` for import handling;
- a focused Web module for canonical time helpers if separation improves testability;
- a focused Web module or existing access-control/render layer for grouped student rendering and group changes;
- `scripts/build_single_file_release.py` if a bundled spreadsheet parser or new Web module must be inlined;
- `tests/web/*.test.cjs` for regression coverage.

The canonical base HTML should only be changed where necessary for the student view controls or accepted file input types.

## 8. Tests and acceptance criteria

### Time

Tests must verify:

- valid canonical values: `00:00`, `07:05`, `13:45`, `23:59`;
- invalid values: `24:00`, `25:10`, minutes above 59, malformed strings;
- displayed session/class times remain `HH:MM`.

### Student grouping

Tests must verify:

- students render under the correct class family;
- groups render as separate visual sections;
- group styles are deterministic;
- group selector exposes only compatible target groups;
- changing group updates only `class_id` and refreshes authoritative state.

### Import

Tests must verify:

- UTF-8 CSV with accented names;
- semicolon-delimited CSV exported by spreadsheet software;
- quoted fields;
- Windows-1252 CSV fallback;
- removal/rejection of NUL/control characters;
- real `.xlsx` parsing;
- real `.xls` parsing if supported by the bundled parser;
- row-level rejection reporting;
- no `unsupported Unicode escape sequence` for valid imported student data.

### Regression

The Web test suite must continue to verify:

- attendance visible after session selection;
- teacher/admin attendance authorization;
- grades editable after closure;
- `grade_only` behavior;
- standalone HTML generation succeeds;
- the final Web artifact is self-contained for its application code and bundled import dependency.

## 9. Delivery

The final deliverable is one corrected standalone Web HTML file derived from the previously corrected application. Windows and Android artifacts are explicitly excluded from this change.
