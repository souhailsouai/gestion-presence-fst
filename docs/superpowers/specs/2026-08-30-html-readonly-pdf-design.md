# HTML Teacher Read-Only Visibility and Integrated PDF Design

## Scope

This design applies first to the final HTML application. Windows and Android/APK will reuse the same authorization and PDF behavior after the HTML implementation is validated.

## Roles and authorization model

### Teacher

A teacher has full management rights over records owned by their authenticated Supabase user id:

- classes
- students
- sessions
- attendance
- comments
- grades
- session reports
- general reports

For data owned by another teacher, the teacher has read-only access only to the following session metadata:

- teacher display name
- track / class / group
- module
- session date
- start time
- end time
- room

The teacher must not be able to view another teacher's:

- student list
- attendance statuses
- attendance comments
- grades
- session PDF
- detailed/general PDF containing private pedagogical data

The UI must label foreign sessions as `Lecture seule` and must not expose edit, delete, attendance, grade, completion, or report-generation controls for them.

The frontend restriction is secondary. Supabase RLS is the authoritative security boundary.

### Admin

An Admin can view and manage all teachers and all pedagogical data.

The Admin can:

- view every class, student, session, attendance record, comment, and grade
- create, update, and delete records for any teacher where the existing admin workflow permits it
- open and modify any session
- generate a PDF for any session
- generate a global report across all teachers
- filter global reporting by teacher

Admin authorization continues to rely on server-side authorization through the existing `private.is_admin()` mechanism and trusted role metadata, not editable user metadata.

## Supabase data access

### `classes`

Authenticated teachers may SELECT class metadata for all teachers so that foreign sessions can display class/group/module context.

INSERT, UPDATE, and DELETE remain restricted to:

- the row owner (`teacher_id = auth.uid()`), or
- Admin.

### `sessions`

Authenticated teachers may SELECT session metadata for all teachers.

INSERT, UPDATE, and DELETE remain restricted to:

- the row owner (`teacher_id = auth.uid()`), or
- Admin.

UPDATE must retain both `USING` and `WITH CHECK` ownership/admin predicates.

### `students`

SELECT, INSERT, UPDATE, and DELETE remain owner-or-Admin only. Teachers must not see students belonging to another teacher.

### `attendance`

SELECT, INSERT, UPDATE, and DELETE remain owner-or-Admin only. Teachers must not see attendance, comments, or grades belonging to another teacher.

### Teacher directory

Teacher names needed for read-only foreign session metadata are resolved through the existing authenticated teacher directory mechanism. No additional private profile fields are exposed.

## HTML data model and rendering

The HTML data loader must distinguish:

- owned classes/sessions: editable
- foreign classes/sessions: metadata only, read-only
- owned students/attendance: fully available
- foreign students/attendance: absent from the teacher client dataset
- Admin mode: all data available and editable

A shared helper such as `canManageRecord(record)` must return true when:

- current user is Admin, or
- `record.teacherId === currentTeacher.id`

All write operations must verify ownership/admin eligibility before issuing a Supabase mutation. Supabase RLS remains the final enforcement layer.

Foreign sessions shown to a teacher must display only the approved metadata fields and a visible `Lecture seule` indicator.

## PDF generation

### Selected approach

Use client-side PDF generation integrated into the final HTML itself.

The final HTML must not depend on CDN loading at report-generation time. The required PDF engine assets must be bundled/inlined during the build process so the final HTML contains everything required for PDF creation.

The intended engine is jsPDF with AutoTable-compatible table generation, bundled locally into the final HTML.

### Session PDF

Teacher:

- may generate only PDFs for sessions they own
- cannot generate a session PDF for another teacher's read-only session

Admin:

- may generate a PDF for any session

Session PDF contents:

- institution name
- academic year 2026/2027
- teacher name
- track / class / group
- module
- date
- start/end time
- room
- student list
- attendance status
- comments when present
- grades when present
- generation timestamp

### General PDF

Teacher:

- report is restricted to the teacher's own classes, students, sessions, attendance, and grades

Admin:

- report may include all teachers
- report may be filtered by one teacher

The general PDF must provide a structured summary and paginated tables without truncating rows across pages.

## Failure behavior

If PDF generation fails, the UI must show an explicit error message and must not claim that the file was generated.

If a teacher attempts a write action on a foreign record through manipulated frontend state, the frontend must reject it before calling Supabase; Supabase RLS must independently reject unauthorized mutations.

If foreign session metadata cannot be resolved completely, the UI may show the available safe fields but must not fall back to loading students or attendance to compensate.

## Testing requirements

### RLS/security tests

Verify that a non-admin teacher:

- can SELECT another teacher's class/session metadata
- cannot UPDATE another teacher's session
- cannot DELETE another teacher's session
- cannot INSERT a session owned by another teacher
- cannot SELECT another teacher's students
- cannot SELECT another teacher's attendance
- cannot UPDATE another teacher's attendance or grade

Verify that an Admin can read and manage all of the above.

### HTML tests

Verify that:

- foreign sessions are rendered with `Lecture seule`
- foreign session edit/delete/attendance/grade/report controls are absent or disabled
- owned sessions remain editable
- Admin sessions remain editable regardless of owner
- PDF code is bundled into the final HTML rather than referenced through external CDN URLs
- session PDF generation is blocked for a teacher on a foreign session
- session PDF generation is allowed for the owner and Admin
- general teacher PDF filters to the current teacher's data
- general Admin PDF can include all teachers and filter by teacher

## Non-goals for this phase

- changing the approved institutional visual design
- implementing the APK changes before the HTML version is validated
- rebuilding the Windows executable before the HTML version is validated
- adding offline pedagogical storage
- exposing foreign students, attendance, comments, or grades to teachers
