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


-- Extend the existing secure attendance-sheet RPCs so the browser never has to
-- bypass their authorization/version-conflict controls to persist grade origin.
create or replace function private.get_attendance_sheet_impl(p_session_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare v_sheet public.attendance_sheets%rowtype;
begin
  if auth.uid() is null then return jsonb_build_object('ok',false,'code','UNAUTHENTICATED'); end if;
  if not private.can_access_session(p_session_id) then return jsonb_build_object('ok',false,'code','FORBIDDEN'); end if;
  select * into v_sheet from public.attendance_sheets where session_id=p_session_id;
  if not found then return jsonb_build_object('ok',true,'session_id',p_session_id,'revision',0,'records','[]'::jsonb); end if;
  return jsonb_build_object(
    'ok',true,'session_id',p_session_id,'sheet_id',v_sheet.id,'revision',v_sheet.revision,'updated_at',v_sheet.updated_at,
    'records',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',a.id,'student_id',a.student_id,'first_name',s.first_name,'last_name',s.last_name,
        'status',a.status,'comment',a.comment,'grade',a.grade,'grade_origin',a.grade_origin,
        'manual_grade_backup',a.manual_grade_backup,'updated_at',a.updated_at,'revision',a.revision
      ) order by s.last_name,s.first_name)
      from public.attendance a
      join public.students s on s.id=a.student_id
      where a.session_id=p_session_id and a.deleted_at is null
    ),'[]'::jsonb)
  );
end;
$function$;

create or replace function private.save_attendance_sheet_impl(
  p_session_id uuid,
  p_expected_revision bigint,
  p_operation_id uuid,
  p_records jsonb,
  p_justification text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid:=auth.uid();
  v_admin boolean;
  v_session public.sessions%rowtype;
  v_sheet public.attendance_sheets%rowtype;
  v_existing jsonb;
  v_response jsonb;
  v_correlation uuid:=gen_random_uuid();
  v_count integer;
  v_distinct integer;
  v_record jsonb;
  v_student uuid;
  v_status text;
  v_comment text;
  v_grade numeric;
  v_grade_origin text;
  v_manual_grade_backup numeric;
begin
  if v_actor is null then return jsonb_build_object('ok',false,'code','UNAUTHENTICATED','correlation_id',v_correlation); end if;

  select response into v_existing from public.operation_receipts
  where actor_id=v_actor and operation_id=p_operation_id and operation_type='save_attendance_sheet';
  if found then return v_existing; end if;

  select * into v_session from public.sessions where id=p_session_id and deleted_at is null for update;
  if not found then return jsonb_build_object('ok',false,'code','VALIDATION_ERROR','field','session_id','correlation_id',v_correlation); end if;

  v_admin:=private.is_admin();
  if not(v_admin or v_session.teacher_id=v_actor) then return jsonb_build_object('ok',false,'code','FORBIDDEN','correlation_id',v_correlation); end if;
  if not private.mutation_allowed() then return jsonb_build_object('ok',false,'code','MFA_REQUIRED','correlation_id',v_correlation); end if;
  if jsonb_typeof(p_records)<>'array' then return jsonb_build_object('ok',false,'code','VALIDATION_ERROR','field','records','correlation_id',v_correlation); end if;

  insert into public.attendance_sheets(id,session_id,revision,updated_by)
  values(p_session_id,p_session_id,0,v_actor) on conflict(session_id) do nothing;
  select * into v_sheet from public.attendance_sheets where session_id=p_session_id for update;
  if v_sheet.revision<>p_expected_revision then
    return jsonb_build_object('ok',false,'code','VERSION_CONFLICT','revision',v_sheet.revision,'correlation_id',v_correlation);
  end if;

  select count(*),count(distinct value->>'student_id') into v_count,v_distinct from jsonb_array_elements(p_records);
  if v_count<>v_distinct then return jsonb_build_object('ok',false,'code','VALIDATION_ERROR','field','duplicate_student_id','correlation_id',v_correlation); end if;

  for v_record in select value from jsonb_array_elements(p_records) loop
    begin v_student:=(v_record->>'student_id')::uuid;
    exception when others then return jsonb_build_object('ok',false,'code','VALIDATION_ERROR','field','student_id','correlation_id',v_correlation); end;

    v_status:=v_record->>'status';
    v_comment:=coalesce(v_record->>'comment','');
    if v_status not in('present','absent','retard','justifie') then
      return jsonb_build_object('ok',false,'code','VALIDATION_ERROR','field','status','correlation_id',v_correlation);
    end if;

    if v_record?'grade' and nullif(v_record->>'grade','') is not null then
      begin v_grade:=(v_record->>'grade')::numeric;
      exception when others then return jsonb_build_object('ok',false,'code','VALIDATION_ERROR','field','grade','correlation_id',v_correlation); end;
      if v_grade<0 or v_grade>20 then return jsonb_build_object('ok',false,'code','VALIDATION_ERROR','field','grade','correlation_id',v_correlation); end if;
    else v_grade:=null; end if;

    v_grade_origin:=nullif(v_record->>'grade_origin','');
    if v_grade_origin is not null and v_grade_origin not in ('manual','absence_auto') then
      return jsonb_build_object('ok',false,'code','VALIDATION_ERROR','field','grade_origin','correlation_id',v_correlation);
    end if;
    if v_record?'manual_grade_backup' and nullif(v_record->>'manual_grade_backup','') is not null then
      begin v_manual_grade_backup:=(v_record->>'manual_grade_backup')::numeric;
      exception when others then return jsonb_build_object('ok',false,'code','VALIDATION_ERROR','field','manual_grade_backup','correlation_id',v_correlation); end;
      if v_manual_grade_backup<0 or v_manual_grade_backup>20 then
        return jsonb_build_object('ok',false,'code','VALIDATION_ERROR','field','manual_grade_backup','correlation_id',v_correlation);
      end if;
    else v_manual_grade_backup:=null; end if;

    -- Database-side invariant: an unjustified absence always owns an automatic zero.
    if v_status='absent' then
      if v_grade_origin='manual' then v_manual_grade_backup:=v_grade; end if;
      v_grade:=0;
      v_grade_origin:='absence_auto';
    elsif v_status='justifie' then
      if v_grade_origin='manual' then v_manual_grade_backup:=v_grade; end if;
      v_grade:=null;
      v_grade_origin:=null;
    elsif v_grade_origin='absence_auto' then
      v_grade:=v_manual_grade_backup;
      v_grade_origin:=case when v_manual_grade_backup is null then null else 'manual' end;
      v_manual_grade_backup:=null;
    elsif v_grade is not null and v_grade_origin is null then
      v_grade_origin:='manual';
    end if;

    if not exists(select 1 from public.students s where s.id=v_student and s.class_id=v_session.class_id and s.deleted_at is null) then
      return jsonb_build_object('ok',false,'code','VALIDATION_ERROR','field','student_membership','correlation_id',v_correlation);
    end if;

    insert into public.attendance(
      teacher_id,session_id,student_id,status,comment,grade,grade_updated_at,
      grade_origin,manual_grade_backup,attendance_sheet_id,updated_by,grade_only
    ) values(
      v_session.teacher_id,p_session_id,v_student,v_status,v_comment,v_grade,
      case when v_grade is null then null else now() end,v_grade_origin,v_manual_grade_backup,v_sheet.id,v_actor,false
    )
    on conflict(session_id,student_id) do update
    set status=excluded.status,
        comment=excluded.comment,
        grade=excluded.grade,
        grade_updated_at=case when excluded.grade is distinct from public.attendance.grade then now() else public.attendance.grade_updated_at end,
        grade_origin=excluded.grade_origin,
        manual_grade_backup=excluded.manual_grade_backup,
        attendance_sheet_id=v_sheet.id,
        updated_by=v_actor,
        grade_only=false;
  end loop;

  update public.attendance_sheets set revision=revision+1,updated_at=now(),updated_by=v_actor
  where id=v_sheet.id returning * into v_sheet;

  v_response:=private.get_attendance_sheet_impl(p_session_id)
    ||jsonb_build_object('operation_id',p_operation_id,'correlation_id',v_correlation);

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,correlation_id,before_state,after_state,justification)
  values(v_actor,'attendance.sheet.saved','attendance_sheet',v_sheet.id,v_correlation,
    jsonb_build_object('revision',p_expected_revision),v_response,nullif(trim(p_justification),''));

  insert into public.operation_receipts(actor_id,operation_id,operation_type,correlation_id,response)
  values(v_actor,p_operation_id,'save_attendance_sheet',v_correlation,v_response);

  return v_response;
exception when others then
  return jsonb_build_object('ok',false,'code','INTERNAL_ERROR','correlation_id',v_correlation);
end;
$function$;


-- Strict LPC3 boundary: the institutional owner is the only authenticated
-- account allowed to read or mutate TP Ondes et Vibrations records.
create or replace function private.is_lpc3_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists(
    select 1 from public.super_admin_owner o
    where o.singleton is true and o.user_id=(select auth.uid())
  );
$function$;

create or replace function private.can_access_session(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists(
    select 1
    from public.sessions s
    join public.classes c on c.id=s.class_id
    where s.id=p_session_id
      and s.deleted_at is null
      and (
        (c.module='TP Ondes et Vibrations' and private.is_lpc3_owner())
        or
        (c.module is distinct from 'TP Ondes et Vibrations'
          and (private.is_admin() or s.teacher_id=(select auth.uid())))
      )
  );
$function$;

create or replace function private.can_access_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists(
    select 1
    from public.students s
    join public.classes c on c.id=s.class_id
    where s.id=p_student_id and s.deleted_at is null
      and (
        (c.module='TP Ondes et Vibrations' and private.is_lpc3_owner())
        or
        (c.module is distinct from 'TP Ondes et Vibrations' and (
          private.is_admin()
          or s.teacher_id=(select auth.uid())
          or exists(select 1 from public.session_plans sp where sp.class_id=s.class_id and sp.teacher_id=(select auth.uid()) and sp.deleted_at is null)
          or exists(select 1 from public.sessions se where se.class_id=s.class_id and se.teacher_id=(select auth.uid()) and se.deleted_at is null)
        ))
      )
  );
$function$;

drop policy if exists sessions_select_authorized on public.sessions;
create policy sessions_select_authorized on public.sessions
for select to authenticated
using (private.can_access_session(id));

drop policy if exists students_select_authorized on public.students;
create policy students_select_authorized on public.students
for select to authenticated
using (private.can_access_student(id));

-- Keep admin CRUD for MPI1-PC1, but never allow a non-owner admin to mutate LPC3.
drop policy if exists classes_update_authorized on public.classes;
create policy classes_update_authorized on public.classes
for update to authenticated
using (
  private.mutation_allowed() and current_user_is_admin()
  and (module is distinct from 'TP Ondes et Vibrations' or private.is_lpc3_owner())
)
with check (
  private.mutation_allowed() and current_user_is_admin()
  and (module is distinct from 'TP Ondes et Vibrations' or private.is_lpc3_owner())
);

drop policy if exists classes_delete_authorized on public.classes;
create policy classes_delete_authorized on public.classes
for delete to authenticated
using (
  private.mutation_allowed() and current_user_is_admin()
  and (module is distinct from 'TP Ondes et Vibrations' or private.is_lpc3_owner())
);

drop policy if exists sessions_update_authorized on public.sessions;
create policy sessions_update_authorized on public.sessions
for update to authenticated
using (
  private.mutation_allowed() and private.can_access_session(id)
)
with check (
  private.mutation_allowed() and private.can_access_session(id)
);

drop policy if exists sessions_delete_authorized on public.sessions;
create policy sessions_delete_authorized on public.sessions
for delete to authenticated
using (
  private.mutation_allowed() and private.can_access_session(id)
);

drop policy if exists students_update_authorized on public.students;
create policy students_update_authorized on public.students
for update to authenticated
using (
  private.mutation_allowed()
  and (
    private.is_lpc3_owner() and exists(
      select 1 from public.classes c where c.id=students.class_id and c.module='TP Ondes et Vibrations'
    )
    or current_user_is_admin() and exists(
      select 1 from public.classes c where c.id=students.class_id and c.module is distinct from 'TP Ondes et Vibrations'
    )
  )
)
with check (private.can_access_student(id));

drop policy if exists students_delete_authorized on public.students;
create policy students_delete_authorized on public.students
for delete to authenticated
using (
  private.mutation_allowed()
  and (
    private.is_lpc3_owner() and exists(
      select 1 from public.classes c where c.id=students.class_id and c.module='TP Ondes et Vibrations'
    )
    or current_user_is_admin() and exists(
      select 1 from public.classes c where c.id=students.class_id and c.module is distinct from 'TP Ondes et Vibrations'
    )
  )
);
