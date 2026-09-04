begin;

-- Manual production operation only. Never run automatically as a migration.
do $$
declare
  v_cycle_id uuid;
  v_cycle_count integer;
  v_local_now timestamp:=timezone('Africa/Tunis',now());
  v_week record;
  v_check jsonb;
  v_affected integer:=0;
begin
  select count(*),min(id) into v_cycle_count,v_cycle_id
  from public.v515_cycles
  where academic_year='2026/2027' and semester=1;

  if v_cycle_count<>1 or v_cycle_id is null then
    raise exception 'CYCLE_NOT_UNIQUE: expected exactly one 2026/2027 semester=1 cycle, found %',v_cycle_count;
  end if;

  if not exists(
    select 1 from public.v515_cycles
    where id=v_cycle_id and status in ('published','assignments_finalized')
  ) then
    raise exception 'INVALID_CYCLE_STATE: cycle must be published or assignments_finalized';
  end if;

  -- Structural dates that differ from the old materialized calendar.
  if exists(
    select 1 from public.v515_sessions s
    where s.cycle_id=v_cycle_id
      and s.session_date in ('2026-10-15','2026-10-22','2026-10-29','2026-11-12','2026-11-19','2026-11-26','2026-12-03')
      and (s.lifecycle_status='completed' or v_local_now >= s.session_date::timestamp+s.start_time)
  ) then
    raise exception 'SESSION_ALREADY_STARTED: an affected Thursday is historical or completed';
  end if;

  -- Protect attendance, grade and comment history linked through mapped legacy plans.
  if exists(
    select 1
    from public.v515_assignments a
    join public.v515_sessions vs on vs.id=a.session_id
    join public.session_plans sp on sp.id=a.legacy_plan_id
    join public.attendance att on att.session_id=sp.session_id
    where a.cycle_id=v_cycle_id
      and vs.session_date in ('2026-10-15','2026-10-22','2026-10-29','2026-11-12','2026-11-19','2026-11-26','2026-12-03')
      and (
        att.status is not null
        or att.grade is not null
        or nullif(btrim(coalesce(att.comment,'')),'') is not null
      )
  ) then
    raise exception 'HISTORICAL_PRESENCE_DATA: attendance/grade/comment exists on an affected structural session';
  end if;

  -- 15/10/2026: JOUR FERIE — Fête de l''Évacuation — aucun TP.
  -- Delete only future structural assignments/materialized plans for that date.
  delete from public.session_plans sp
  using public.v515_assignments a,public.v515_sessions s
  where a.legacy_plan_id=sp.id
    and a.session_id=s.id
    and s.cycle_id=v_cycle_id
    and s.session_date='2026-10-15';

  delete from public.v515_assignments a
  using public.v515_sessions s
  where a.session_id=s.id
    and s.cycle_id=v_cycle_id
    and s.session_date='2026-10-15';

  update public.v515_sessions
  set is_teaching_session=false,
      class_name=null,
      non_teaching_reason='JOUR FERIE - Fete de l''Evacuation',
      effective_session_index=null,
      class_occurrence=null,
      lifecycle_status='published',
      updated_at=now()
  where cycle_id=v_cycle_id and session_date='2026-10-15';

  -- DS / REPOS week: no TP.
  update public.v515_sessions
  set is_teaching_session=false,
      class_name=null,
      non_teaching_reason='DS - aucun TP',
      effective_session_index=null,
      class_occurrence=null,
      lifecycle_status='published',
      updated_at=now()
  where cycle_id=v_cycle_id
    and session_date in ('2026-11-02','2026-11-05','2026-11-06');

  -- Approved Thursday alternation after the holiday. The holiday does not advance the occurrence.
  update public.v515_sessions set class_name='MPI1-C',class_occurrence=3,effective_session_index=5,updated_at=now() where cycle_id=v_cycle_id and session_date='2026-10-22';
  update public.v515_sessions set class_name='MPI1-D',class_occurrence=3,effective_session_index=6,updated_at=now() where cycle_id=v_cycle_id and session_date='2026-10-29';
  update public.v515_sessions set class_name='MPI1-C',class_occurrence=4,effective_session_index=7,updated_at=now() where cycle_id=v_cycle_id and session_date='2026-11-12';
  update public.v515_sessions set class_name='MPI1-D',class_occurrence=4,effective_session_index=8,updated_at=now() where cycle_id=v_cycle_id and session_date='2026-11-19';
  update public.v515_sessions set class_name='MPI1-C',class_occurrence=5,effective_session_index=9,updated_at=now() where cycle_id=v_cycle_id and session_date='2026-11-26';
  update public.v515_sessions set class_name='MPI1-D',class_occurrence=5,effective_session_index=10,updated_at=now() where cycle_id=v_cycle_id and session_date='2026-12-03';

  -- Never invent teachers or rooms. Existing future rows must already have a valid Admin-approved manual plan.
  if exists(
    select 1
    from public.v515_sessions s
    join public.v515_assignments a on a.session_id=s.id
    where s.cycle_id=v_cycle_id and s.is_teaching_session
      and s.session_date>='2026-09-14'
    group by s.id
    having count(a.id)<>4 or count(distinct a.teacher_id)<>4 or count(distinct a.room)<>4
  ) then
    raise exception 'VALID_MANUAL_PLAN_REQUIRED: fix teacher/room assignments in TEST before production reconciliation (ROOM_TIME_CONFLICT possible)';
  end if;

  -- Every active week must satisfy normal or holiday-reduced teacher distribution.
  for v_week in
    select distinct date_trunc('week',session_date)::date week_start
    from public.v515_sessions
    where cycle_id=v_cycle_id and is_teaching_session
    order by 1
  loop
    v_check:=public.v16_verify_teacher_week(v_week.week_start,'real');
    if not coalesce((v_check->>'ok')::boolean,false) then
      raise exception 'VALID_MANUAL_PLAN_REQUIRED:%',v_check::text;
    end if;
  end loop;

  select count(*) into v_affected
  from public.v515_sessions
  where cycle_id=v_cycle_id
    and session_date in ('2026-10-15','2026-10-22','2026-10-29','2026-11-02','2026-11-05','2026-11-06','2026-11-12','2026-11-19','2026-11-26','2026-12-03');

  perform private.v515_audit(
    v_cycle_id,
    'v16_official_calendar_reconciled',
    null,
    'Calendrier V16 officiel réconcilié après validation manuelle.',
    jsonb_build_object('affected_calendar_rows',v_affected,'holiday','2026-10-15','ds_dates',jsonb_build_array('2026-11-02','2026-11-05','2026-11-06'))
  );
end;
$$;

commit;
