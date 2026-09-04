begin;

-- Multi-row week saves and TEST→REAL applies can legitimately swap manipulation
-- codes between groups. Validate the final transaction state, not row order.
drop trigger if exists v16_real_group_manip_history_guard on public.v515_assignments;
create constraint trigger v16_real_group_manip_history_guard
after insert or update on public.v515_assignments
deferrable initially deferred
for each row execute function private.v16_enforce_real_group_manip_history();

drop trigger if exists v16_test_group_manip_history_guard on public.v16_test_assignments;
create constraint trigger v16_test_group_manip_history_guard
after insert or update on public.v16_test_assignments
deferrable initially deferred
for each row execute function private.v16_enforce_test_group_manip_history();

-- Effective TEST cloning is allowed only after the REAL calendar has been
-- reconciled to the approved holiday/Thursday sequence. Teacher and legacy room
-- values are copied, but manipulation codes are seeded from the approved class
-- occurrence pattern so TEST starts from the official pedagogical sequence.
create or replace function public.v16_clone_real_to_test(
  p_effective_date date
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_cycle_id uuid;
  v_sessions integer:=0;
  v_assignments integer:=0;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not(select private.is_admin()) then
    return jsonb_build_object('ok',false,'code','FORBIDDEN','message','Accès Admin requis.');
  end if;
  if p_effective_date is null then
    return jsonb_build_object('ok',false,'code','EFFECTIVE_DATE_REQUIRED','message','Date d’effet requise.');
  end if;

  select id into v_cycle_id
  from public.v515_cycles
  where academic_year='2026/2027' and semester=1
  limit 1;
  if v_cycle_id is null then
    return jsonb_build_object('ok',false,'code','CYCLE_NOT_FOUND','message','Planning RÉEL non initialisé.');
  end if;

  if exists(
    select 1 from public.v515_sessions
    where cycle_id=v_cycle_id and session_date='2026-10-15' and is_teaching_session
  ) or not exists(
    select 1 from public.v515_sessions
    where cycle_id=v_cycle_id and session_date='2026-10-22'
      and is_teaching_session and class_name='MPI1-C' and class_occurrence=3
  ) then
    return jsonb_build_object(
      'ok',false,'code','REAL_CALENDAR_NOT_RECONCILED',
      'message','Réconcilier d’abord le calendrier RÉEL officiel avant de cloner vers TEST.'
    );
  end if;

  delete from public.v16_test_attendance;
  delete from public.v16_test_assignments;
  delete from public.v16_test_sessions;
  delete from public.v16_test_scenarios;

  insert into public.v16_test_sessions(
    context,real_session_id,session_date,start_time,end_time,class_name,lifecycle_status,created_by
  )
  select
    'test',s.id,s.session_date,s.start_time,s.end_time,
    case when s.is_teaching_session then s.class_name else null end,
    s.lifecycle_status,auth.uid()
  from public.v515_sessions s
  where s.cycle_id=v_cycle_id
    and s.session_date>=p_effective_date
    and s.session_date<>'2026-10-15'
  order by s.session_date,s.start_time;
  get diagnostics v_sessions=row_count;

  insert into public.v16_test_assignments(
    context,test_session_id,real_assignment_id,group_no,manipulation_code,teacher_id,room,created_by
  )
  select
    'test',ts.id,a.id,a.group_no,
    case s.class_occurrence
      when 1 then (array['M1','M2','M3','M4'])[a.group_no]
      when 2 then (array['M2','M3','M4','M1'])[a.group_no]
      when 3 then (array['M3','M4','M1','M2'])[a.group_no]
      when 4 then (array['M4','M1','M2','M3'])[a.group_no]
      when 5 then (array['M5','M6','M5','M6'])[a.group_no]
      when 6 then (array['M6','M5','M6','M5'])[a.group_no]
      else a.manipulation_code
    end,
    a.teacher_id,a.room,auth.uid()
  from public.v515_assignments a
  join public.v515_sessions s on s.id=a.session_id
  join public.v16_test_sessions ts on ts.real_session_id=s.id
  where a.cycle_id=v_cycle_id
    and s.is_teaching_session
    and s.session_date>=p_effective_date
    and s.session_date<>'2026-10-15'
  order by s.session_date,a.group_no;
  get diagnostics v_assignments=row_count;

  perform private.v515_audit(
    v_cycle_id,'v16_real_cloned_to_test',null,
    'Calendrier RÉEL réconcilié cloné vers TEST avec séquence de manipulations officielle.',
    jsonb_build_object('effective_date',p_effective_date,'sessions',v_sessions,'assignments',v_assignments)
  );

  return jsonb_build_object(
    'ok',true,'effective_date',p_effective_date,
    'sessions',v_sessions,'assignments',v_assignments
  );
end;
$$;

revoke execute on function public.v16_clone_real_to_test(date) from public,anon;
grant execute on function public.v16_clone_real_to_test(date) to authenticated;

commit;
