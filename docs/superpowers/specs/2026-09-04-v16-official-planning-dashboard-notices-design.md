# V16 Official Planning, Manual Assignment and Dashboard Notices Design

## Goal
Align the private V16 application and the production planning model with the planning files supplied on 04/09/2026 plus the user's explicit corrections, while preserving TEST/REAL isolation and existing attendance/grade behavior.

## Authoritative time slots
- Monday: 13:45–17:30, alternating MPI1-A / MPI1-E, starting with MPI1-A.
- Thursday: 13:30–17:30, alternating MPI1-C / MPI1-D, starting with MPI1-C.
- Friday: 13:30–17:30, alternating MPI1-B / PC1-A, starting with MPI1-B.
- Week 02/11/2026–08/11/2026: DS / no TP.
- 15/10/2026 remains a public holiday and has no TP.

## Default manipulation planning
The application seeds the approved class-occurrence pattern below. It is editable by Admin and independent of teacher selection.

- Occurrence 1: G1=M1, G2=M2, G3=M3, G4=M4.
- Occurrence 2: G1=M2, G2=M3, G3=M4, G4=M1.
- Occurrence 3: G1=M3, G2=M4, G3=M1, G4=M2.
- Occurrence 4: G1=M4, G2=M1, G3=M2, G4=M3.
- Occurrence 5: G1=M5, G2=M6, G3=M5, G4=M6.
- Occurrence 6: G1=M6, G2=M5, G3=M6, G4=M5.

This explicitly allows the same manipulation to run simultaneously for multiple groups provided rooms differ and each individual group has not already completed that manipulation.

## Calendar
### Monday — MPI1-A / MPI1-E
- 14/09 MPI1-A occurrence 1
- 21/09 MPI1-E occurrence 1
- 28/09 MPI1-A occurrence 2
- 05/10 MPI1-E occurrence 2
- 12/10 MPI1-A occurrence 3
- 19/10 MPI1-E occurrence 3
- 26/10 MPI1-A occurrence 4
- 02/11 DS
- 09/11 MPI1-E occurrence 4
- 16/11 MPI1-A occurrence 5
- 23/11 MPI1-E occurrence 5
- 30/11 MPI1-A occurrence 6 = M6/M5/M6/M5

### Thursday — MPI1-C / MPI1-D
- 17/09 MPI1-C occurrence 1
- 24/09 MPI1-D occurrence 1
- 01/10 MPI1-C occurrence 2
- 08/10 MPI1-D occurrence 2
- 15/10 public holiday — no TP
- 22/10 MPI1-C occurrence 3
- 29/10 MPI1-D occurrence 3
- 05/11 DS
- 12/11 MPI1-C occurrence 4
- 19/11 MPI1-D occurrence 4
- 26/11 MPI1-C occurrence 5
- 03/12 MPI1-D occurrence 5

### Friday — MPI1-B / PC1-A
- 18/09 MPI1-B occurrence 1
- 25/09 PC1-A occurrence 1
- 02/10 MPI1-B occurrence 2
- 09/10 PC1-A occurrence 2
- 16/10 MPI1-B occurrence 3
- 23/10 PC1-A occurrence 3
- 30/10 MPI1-B occurrence 4
- 06/11 DS
- 13/11 PC1-A occurrence 4
- 20/11 MPI1-B occurrence 5
- 27/11 PC1-A occurrence 5
- 04/12 MPI1-B occurrence 6

## Admin planning editor
For every future teaching session and every G1–G4 row, Admin can choose manually:
- teacher: any of the six authorised teachers;
- manipulation: M1–M6;
- room: A, B, C or D.

The supplied planning is the default schedule; teacher/manipulation/room choices remain Admin-editable subject to blocking constraints.

## Teacher rules
Authorised teachers:
- Nadia Bouaziz
- Olfa Turki
- Souhail Souai
- Khaoula Rais
- Tarek Sbeouelji
- Mouna Triki

There is no fixed teacher-to-manipulation matrix.

### Normal week with 3 TP days
- exactly 4 distinct teachers per teaching day;
- each of the six teachers teaches exactly 2 distinct days in the week;
- no teacher may be counted more than once on the same day;
- no teacher may exceed 2 teaching days in the week.

### Week reduced by one public holiday to 2 TP days
- the holiday has no TP;
- exactly 4 distinct teachers on each remaining teaching day;
- exactly 2 teachers teach both days;
- the other 4 teachers teach exactly 1 day;
- Admin freely chooses which 2 teachers teach both days;
- no teacher may exceed 2 teaching days in the week.

For the week containing 15/10/2026, only Monday 12/10 and Friday 16/10 are teaching days and the required teacher-day distribution is 2,2,1,1,1,1.

### DS week
- no TP;
- 0 teacher assignments;
- weekly teacher quota validation is skipped because there are no teaching days.

## Manipulation rules
- Admin chooses M1–M6 manually for each group.
- The same manipulation may be assigned to multiple groups in the same session.
- For a given class + group, a manipulation already assigned/completed earlier in the cycle is strictly forbidden from being repeated.
- This prohibition is blocking in both UI and Supabase.
- The approved end-of-cycle patterns M5/M6/M5/M6 and M6/M5/M6/M5 are valid because each individual group follows a non-repeating sequence.

## Room rules
- Two groups in the same session/time slot must always use different rooms.
- Room conflict is blocking.
- Duplicate manipulation codes are allowed only with different rooms.
- When duplicated manipulations occur in the default planning, room is initially displayed as "À choisir" instead of being inferred from the manipulation code.
- Final save/finalisation is blocked while a room is missing or duplicated.

## Atomic weekly validation
Teacher quotas span multiple days, so Admin edits must be validated at week level. The UI may stage local changes, but the backend validates the complete affected week before committing REAL changes.

The weekly validator determines the week type from the teaching calendar:
- 3 teaching days: each teacher exactly 2 days;
- 2 teaching days because of a holiday: distribution 2,2,1,1,1,1;
- 0 teaching days in DS week: no assignments.

Every week also enforces a maximum of 2 teaching days per teacher.

Room uniqueness and class/group manipulation history are validated transactionally with the teacher rules.

## Database design
The current V5.15 assignment schema has `unique(session_id, manipulation_code)`, which blocks simultaneous duplicate manipulations and must be removed by a new migration.

Editable future planning needs an unselected-room state. Use a nullable room or equivalent staging representation while the Admin is editing, but a final REAL save cannot contain an unselected room.

Add an Admin-only SECURITY INVOKER RPC for transactional weekly planning updates. It validates:
1. authenticated Admin;
2. future/not-started sessions only;
3. exactly four group rows per teaching session;
4. teacher distribution according to week type;
5. maximum 2 teaching days per teacher per week;
6. no duplicate room within a session;
7. manipulation code limited to M1–M6;
8. no repeated manipulation for the same class + group across the cycle;
9. TEST/REAL isolation;
10. audit before/after changes.

Do not modify unrelated legacy security warnings or legacy SECURITY DEFINER functions.

## TEST / REAL
- TEST remains Admin-only and isolated.
- The same manual teacher/manipulation/room editing model is available in TEST.
- Applying TEST → REAL copies only future structural planning fields: teacher, manipulation and room.
- Attendance, grades and comments are never copied from TEST.
- REAL apply uses the same teacher-week, room and manipulation-history validation.

## Planning UI
Keep the existing V16 Planning des séances page, filters, teacher/admin views and exports. Admin receives editable teacher/manipulation/room controls; teachers remain read-only.

Validation messages identify the date, group and exact violated rule. Duplicate manipulations are not shown as errors by themselves; only room conflicts or repeated class/group manipulations are errors.

## Dashboard notices
Show two permanent 2026/2027 notice cards on Dashboard for authenticated users.

### Avis n°1 — MPI1
Display corrected information:
- MPI1-A and MPI1-E: Monday 14 September 2026 at 13:45.
- MPI1-C and MPI1-D: Thursday 17 September 2026 at 13:30.
- MPI1-B: Friday 18 September 2026 at 13:30.
- TP rooms: A, B, C and D, ground floor at the entrance of the Physics Department.
- Notice date: 11/09/2026.
- Coordinator: Souhail Souai, souhail.souai@fst.utm.tn.

### Avis n°1 — PC1
Display corrected information:
- PC1-A: Friday 18 September 2026 at 13:30.
- Same room/location information.
- Notice date: 11/09/2026.
- Coordinator: Souhail Souai, souhail.souai@fst.utm.tn.

The dashboard intentionally corrects the source-document timing errors: MPI1 Thursday 13:45 becomes 13:30 and PC1 Friday 13:15 becomes 13:30.

## Production migration safety
Production currently contains a finalised V16 cycle and materialised legacy plans. The implementation must not blindly delete historical/started data. Before any production rewrite:
- inspect affected sessions for attendance, grades, comments and lifecycle state;
- abort structural rewrites for historical/started sessions unless a separate safe migration is explicitly approved;
- migrate only future structural planning;
- preserve attendance/grade/comment records;
- preserve 15/10 as no-TP and DS rows as no-TP;
- keep repository private and do not restore GitHub Pages.

## Acceptance criteria
- Monday, Thursday and Friday time slots match the approved values.
- 15/10 is a no-TP public holiday.
- Week 12/10–18/10 has teacher-day distribution 2,2,1,1,1,1 across the six teachers.
- DS week 02/11–08/11 has no TP or teacher assignments.
- No teacher exceeds 2 teaching days in any week.
- Normal 3-day teaching weeks enforce exactly 4 distinct teachers/day and exactly 2 days/teacher.
- Admin can freely choose any of the six teachers, M1–M6 and rooms A–D for future slots.
- Same manipulation may appear more than once in a session.
- Same room may not appear more than once in a session.
- A class/group can never repeat a manipulation.
- 30/11 MPI1-A defaults to M6/M5/M6/M5.
- Teachers cannot access Admin editing or TEST.
- Dashboard shows both corrected notices.
- Existing attendance and grade permissions remain unchanged.
