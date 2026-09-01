# Web V5 — Planning TP Physique 2026/2027

## 1. Scope

V5 is Web-only. Windows and Android are not modified in this phase.

The application manages TP Physique for the 2026/2027 academic year with:
- MPI1-A, MPI1-B, MPI1-C, MPI1-D, MPI1-E;
- PC1-A only;
- 3 or 4 TP groups per class, exposed as G1-G4;
- module fixed to `TP Physique`;
- weekly timetable reference integrated from the supplied official timetables;
- a dated planning period from 2026-09-14 through 2026-12-13;
- alternating classes every two weeks on Monday, Thursday and Friday;
- per-group manipulation selection M1-M6;
- teacher assignment per planned group/session;
- optional blank/pause weeks;
- presence and grade entry tied to the teacher assigned to the session;
- class PDFs containing all raw grades and calculated averages;
- robust CSV/XLS/XLSX import.

## 2. Official timetable reference

The application contains an immutable built-in reference used only for prefill/reset. The user may override day/start/end on a class/group record without modifying the built-in reference.

| Class | Module | Day | Start | End |
|---|---|---|---|---|
| MPI1-A | TP Physique | Lundi | 13:45 | 18:00 |
| MPI1-B | TP Physique | Vendredi | 13:30 | 17:30 |
| MPI1-C | TP Physique | Jeudi | 13:45 | 17:30 |
| MPI1-D | TP Physique | Jeudi | 13:30 | 17:30 |
| MPI1-E | TP Physique | Lundi | 13:30 | 17:30 |
| PC1-A | TP Physique | Vendredi | 13:30 | 17:30 |

For PC1-A, the source timetable labels the Friday practical block as STA/Travaux Pratiques. Per approved business terminology, the application displays it as `TP Physique`.

## 3. Class and group rules

### 3.1 Class labels
- MPI track: A-E only, displayed as MPI1-A ... MPI1-E.
- PC track: A only, displayed as PC1-A.
- Existing numeric compatibility mapping may remain internal: 1->A, 2->B, 3->C, 4->D, 5->E.
- Numeric labels must not be shown to the user as class names.

### 3.2 Groups
- Operational groups are G1-G4.
- A class may use only G1-G3 or all G1-G4.
- The database constraints already enforce 1-4; V5 aligns the UI with that constraint.
- In Student Management, each class is a visually separate block and its groups have distinct deterministic visual styling.
- Admin can move a student between groups of the same class only.

## 4. Time handling

All time entry and display uses strict 24-hour `HH:MM`.
- Valid examples: 00:00, 07:30, 13:45, 23:59.
- Invalid examples: 7:3, 24:00, 13:72.
- Class day/start/end are prefilled from the official reference.
- Day/start/end remain manually editable.
- A `Rétablir le créneau officiel` action restores the reference values.
- Module is fixed to `TP Physique` and is not a free business choice in V5.

## 5. Dated planning period

Planning covers every calendar week intersecting 2026-09-14 through 2026-12-13.

Default alternating pattern:
- Monday: MPI1-A / MPI1-E alternating every week;
- Thursday: MPI1-C / MPI1-D alternating every week;
- Friday: MPI1-B / PC1-A alternating every week.

Therefore each class normally receives one TP date every two weeks.

Initial sequence:
- Week 2026-09-14: MPI1-A, MPI1-C, MPI1-B;
- Week 2026-09-21: MPI1-E, MPI1-D, PC1-A;
- then repeat the alternating pattern through 2026-12-13.

The generated pattern is a starting plan, not an immutable academic truth. Admin may change dates, mark pauses, or leave assignments undefined.

## 6. Pause / blank week behavior

Each planned weekly slot has a planning status:
- `planned` — active TP planning;
- `pause` — intentionally blank/no teaching session;
- `undefined` — intentionally left for later definition.

A pause or undefined slot must not create a real attendance session automatically.

Admin can later reactivate it and define group manipulations/teacher assignments.

## 7. Manipulations M1-M6

For every active class date, each existing group gets a separate planning row.

Example for MPI1-A on a Monday:
- G1 -> M1
- G2 -> M4
- G3 -> M2
- G4 -> M6 (only if G4 exists)

Rules:
- manipulation is selected manually for every group and every date;
- values are M1, M2, M3, M4, M5, M6, or unassigned;
- no automatic sequence M1->M2->... is imposed;
- changing a manipulation does not alter past completed sessions.

## 8. Teacher assignment

### 8.1 General model
There are initially six teachers, but Admin can add more through the existing account administration workflow.

Each planned group row may have one assigned teacher.

A teacher may therefore be assigned, for example, to one Monday group and one Thursday group in the same week.

### 8.2 Recommended workload
Target workload: 2 assigned teaching sessions per teacher per week.

This is advisory, not a hard constraint.
- 0/2 or 1/2: under target;
- 2/2: target reached;
- >2/2: warning, but Admin may keep the assignment.

### 8.3 Conflict detection
Admin UI warns when:
- a teacher is assigned to overlapping time windows;
- a teacher exceeds 2 planned sessions in a week;
- a planned row has no teacher;
- a planned row has no manipulation.

Warnings do not silently reassign teachers.

## 9. Planning visibility and permissions

### 9.1 All teachers
All authenticated teachers can read:
- complete official timetable;
- complete dated planning;
- all classes/groups;
- all manipulations;
- all teacher assignments;
- views by class/group and by teacher.

They cannot modify planning data unless they are Admin.

### 9.2 Assigned teacher
For a real session assigned to the teacher:
- before closure: may edit attendance, comment, and grade;
- after closure: attendance/comment are locked, grade remains editable;
- may generate/read reports for sessions they are authorized to manage.

A teacher cannot edit presence/grades for another teacher's assigned session.

### 9.3 Admin
Admin can manage:
- timetable overrides;
- dated plan;
- pause/undefined states;
- M1-M6 assignments;
- teacher assignments;
- classes/groups/students;
- teacher accounts;
- attendance and grades;
- all reports and statistics.

## 10. Planning views

Common read-only views for all teachers:
1. `Planning général` — chronological rows for all classes/groups/teachers.
2. `Par classe / groupe` — class block then G1-G4.
3. `Par enseignant` — one teacher's complete assigned schedule.

Admin additionally gets:
4. `Charge enseignants` — weekly counts with 2-session target and conflict warnings.
5. Edit controls for status, manipulation and teacher.

Each planning row shows at minimum:
`Semaine | Date | Jour | Classe | Groupe | Début | Fin | TP Physique | Manip | Enseignant | Statut`.

## 11. Separation between plan and real sessions

Recommended architecture: introduce a dedicated `session_plans` table rather than overloading `sessions`.

### 11.1 session_plans proposed fields
- id uuid PK;
- academic_year_id uuid;
- class_id uuid / existing class-group record reference;
- teacher_id uuid nullable;
- plan_date date;
- start_time time;
- end_time time;
- manipulation text nullable with check M1-M6;
- status text with check planned/pause/undefined;
- session_id uuid nullable, linking to a real session once created;
- revision bigint;
- created_at/updated_at/updated_by/deleted_at consistent with current versioned schema.

RLS must permit all authenticated teachers to SELECT planning rows, but only Admin to INSERT/UPDATE/DELETE planning rows.

### 11.2 Real session lifecycle
- Planning row alone is not an attendance session.
- When an authorized teacher opens/starts an active planned row, the app creates or links one `sessions` record idempotently.
- Attendance and grades continue using current `sessions`, `attendance`, and `attendance_sheets` behavior.
- Pause/undefined plans cannot be started.
- Completed session semantics remain unchanged.

## 12. Existing database compatibility

Current database facts to preserve:
- `classes.group_number` is constrained to 1-4;
- `student_groups.group_number` is constrained to 1-4;
- `sessions` already contains optional assignment/group/course links but no manipulation or pause state;
- attendance grades are 0-20;
- RLS is enabled.

V5 should avoid destructive schema changes. New planning schema is additive.

## 13. Student import

CSV/XLS/XLSX import remains based on ArrayBuffer parsing.

Accepted class labels include:
- MPI1-A ... MPI1-E;
- PC1-A.

Accepted group labels: G1-G4.

Importer requirements:
- UTF-8 fatal decode then Windows-1252 fallback for CSV;
- BOM and NUL/control sanitization;
- semicolon/comma/tab delimiter detection;
- quoted CSV fields;
- XLS/XLSX through SheetJS ArrayBuffer parser;
- entire file validated before persistence;
- unknown class/group rows rejected explicitly;
- no use of `readAsText` for Excel binary files.

## 14. Student class PDF

Each class block has `PDF de la classe`.

PDF contains for every student:
- Nom;
- Prénom;
- Groupe;
- every raw grade by real session with date and module;
- missing grade as `—`;
- calculated mean /20 using only entered numeric grades.

Historical grades must remain visible even when a student later changes group within the same class.

## 15. Reports and planning PDFs

V5 should retain existing session/general PDF capabilities and may add an Admin planning PDF/export containing the filtered planning view.

Teacher planning visibility is read-only for other teachers; export must not grant edit capability.

## 16. Responsive/accessibility requirements

- Desktop/tablet/mobile layouts must remain usable.
- Planning tables may use local horizontal scrolling on narrow screens when the data cannot reflow legibly.
- All controls use labels and native keyboard focus.
- Status and conflict meaning must not rely on color alone; include visible text/icon labels.
- Time values are always displayed as HH:MM.

## 17. Security

- Supabase RLS remains authoritative.
- UI hiding is not considered access control.
- Admin-only planning writes must be enforced server-side.
- Teacher write rights remain limited to attendance/grade records for sessions assigned to that teacher, with the approved post-closure grade exception.
- Realtime refresh should include `session_plans` after migration.

## 18. Acceptance criteria

V5 is accepted when:
1. MPI1-A-E and PC1-A are the only class families exposed.
2. Groups exposed are G1-G4.
3. TP Physique timetable values prefill correctly and reset correctly.
4. All times use HH:MM.
5. Planning weeks cover 2026-09-14 through 2026-12-13.
6. Monday/Thursday/Friday alternation is generated as specified.
7. Any weekly slot can be pause or undefined.
8. M1-M6 can be chosen manually per group/date.
9. Admin can assign any existing teacher and newly created teachers become assignable.
10. Weekly workload 2/session target and conflicts are shown as warnings.
11. All teachers can read all planning and timetables.
12. Only Admin can edit planning assignments.
13. Teachers can edit attendance/comment/grade only for their sessions before closure, and grade only after closure.
14. CSV/XLS/XLSX import works without unsupported-Unicode binary parsing failures.
15. Class PDFs retain all raw grades plus mean.
16. Pause/undefined plans never create attendance sessions.
17. Existing attendance and grade data are preserved.
