-- V31 attendance/grade traceability (non-destructive)
-- Adds explicit grade origin so an automatic absence zero cannot be confused
-- with a genuine manual zero. Existing non-null grades are classified manual.

alter table public.attendance
  add column if not exists grade_origin text,
  add column if not exists manual_grade_backup numeric;

update public.attendance
set grade_origin = 'manual'
where grade is not null
  and grade_origin is null;

alter table public.attendance
  drop constraint if exists attendance_grade_origin_check;

alter table public.attendance
  add constraint attendance_grade_origin_check
  check (grade_origin is null or grade_origin in ('manual','absence_auto'));

alter table public.attendance
  drop constraint if exists attendance_grade_range_check;

alter table public.attendance
  add constraint attendance_grade_range_check
  check (grade is null or (grade >= 0 and grade <= 20));

alter table public.attendance
  drop constraint if exists attendance_manual_grade_backup_range_check;

alter table public.attendance
  add constraint attendance_manual_grade_backup_range_check
  check (manual_grade_backup is null or (manual_grade_backup >= 0 and manual_grade_backup <= 20));

create index if not exists attendance_student_session_active_idx
  on public.attendance(student_id, session_id)
  where deleted_at is null;

create index if not exists session_plans_session_manipulation_active_idx
  on public.session_plans(session_id, manipulation)
  where deleted_at is null;

comment on column public.attendance.grade_origin is
  'manual = note saisie par enseignant; absence_auto = zero impose par absence non justifiee';

comment on column public.attendance.manual_grade_backup is
  'Sauvegarde transitoire d une note manuelle remplacee par un zero automatique d absence';
