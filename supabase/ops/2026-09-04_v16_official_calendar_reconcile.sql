begin;

-- OPERATIONAL SCRIPT ONLY. Do not place under supabase/migrations.
-- Run after read-only production preflight and explicit user approval.
-- This operation reconciles calendar identity only. Teacher/manipulation/room
-- choices are applied afterward by authenticated Admin RPC
-- public.v16_apply_test_teacher_plan(date).

do $$
declare
  v_cycle_id uuid;
  v_cycle_count integer;
  v_cycle_status text;
  v_local_now timestamp:=timezone('Africa/Tunis',now());
  v_missing_classes integer:=0;
  v_week record;
  v_day record;
  v_teacher record;
  v_teaching_days integer:=0;
  v_two_days integer:=0;
  v_one_day integer:=0;
  v_zero_days integer:=0;
begin
  select count(*)
    into v_cycle_count
  from public.v515_cycles
  where academic_year='2026/2027'
    and semester=1;

  if v_cycle_count<>1 then
    raise exception 'CYCLE_IDENTITY_INVALID: expected exactly one 2026/2027 semester 1 cycle';
  end if;

  select id,status
    into v_cycle_id,v_cycle_status
  from public.v515_cycles
  where academic_year='2026/2027'
    and semester=1;

  if v_cycle_id is null then
    raise exception 'CYCLE_IDENTITY_INVALID: expected exactly one 2026/2027 semester 1 cycle';
  end if;

  if v_cycle_status<>'assignments_finalized' then
    raise exception 'CYCLE_STATE_INVALID: expected assignments_finalized, got %',v_cycle_status;
  end if;

  -- Protect every row whose class identity or teaching status is changed here.
  if exists(
    select 1
    from public.v515_sessions s
    where s.cycle_id=v_cycle_id
      and s.session_date in (
        date '2026-10-15',date '2026-10-22',date '2026-10-29',
        date '2026-11-05',date '2026-11-12',date '2026-11-19',
        date '2026-11-26',date '2026-12-03'
      )
      and (
        s.lifecycle_status='completed'
        or v_local_now >= (s.session_date::timestamp+s.start_time)
      )
  ) then
    raise exception 'SESSION_ALREADY_STARTED: an affected V16 session has started or completed';
  end if;

  if exists(
    select 1
    from public.session_plans sp
    join public.v515_assignments a on a.legacy_plan_id=sp.id
    join public.v515_sessions s on s.id=a.session_id
    where s.cycle_id=v_cycle_id
      and s.session_date in (
        date '2026-10-15',date '2026-10-22',date '2026-10-29',
        date '2026-11-12',date '2026-11-19',date '2026-11-26',date '2026-12-03'
      )
      and sp.deleted_at is null
      and sp.session_id is not null
  ) then
    raise exception 'SESSION_ALREADY_STARTED: a mapped presence session already exists';
  end if;

  create temporary table v16_thursday_calendar(
    session_date date primary key,
    class_name text,
    effective_session_index integer,
    class_occurrence integer,
    is_teaching boolean,
    reason text
  ) on commit drop;

  insert into v16_thursday_calendar(session_date,class_name,effective_session_index,class_occurrence,is_teaching,reason)
  values
    (date '2026-10-15',null,null,null,false,'JOUR FÉRIÉ - Fête de l''Évacuation - aucun TP'),
    (date '2026-10-22','MPI1-C',5,3,true,null),
    (date '2026-10-29','MPI1-D',6,3,true,null),
    (date '2026-11-05',null,null,null,false,'DS / aucun TP'),
    (date '2026-11-12','MPI1-C',7,4,true,null),
    (date '2026-11-19','MPI1-D',8,4,true,null),
    (date '2026-11-26','MPI1-C',9,5,true,null),
    (date '2026-12-03','MPI1-D',10,5,true,null);

  if (select count(*) from public.v515_sessions s join v16_thursday_calendar c using(session_date) where s.cycle_id=v_cycle_id)<>8 then
    raise exception 'CALENDAR_ROWS_MISSING: expected all eight affected Thursday rows';
  end if;

  create temporary table v16_holiday_legacy_plans on commit drop as
  select a.legacy_plan_id
  from public.v515_assignments a
  join public.v515_sessions s on s.id=a.session_id
  where s.cycle_id=v_cycle_id
    and s.session_date=date '2026-10-15'
    and a.legacy_plan_id is not null;

  if exists(
    select 1
    from public.session_plans sp
    join v16_holiday_legacy_plans h on h.legacy_plan_id=sp.id
    where sp.session_id is not null
      and sp.deleted_at is null
  ) then
    raise exception 'SESSION_ALREADY_STARTED: 15/10 presence plan already started';
  end if;

  update public.session_plans sp
     set deleted_at=now(),
         revision=sp.revision+1,
         updated_at=now()
    from v16_holiday_legacy_plans h
   where h.legacy_plan_id=sp.id
     and sp.session_id is null
     and sp.deleted_at is null;

  delete from public.v515_assignments a
  using public.v515_sessions s
  where a.session_id=s.id
    and s.cycle_id=v_cycle_id
    and s.session_date=date '2026-10-15';

  update public.v515_sessions s
     set class_name=c.class_name,
         is_teaching_session=c.is_teaching,
         non_teaching_reason=c.reason,
         effective_session_index=c.effective_session_index,
         class_occurrence=c.class_occurrence,
         updated_at=now()
    from v16_thursday_calendar c
   where s.cycle_id=v_cycle_id
     and s.session_date=c.session_date;

  update public.v515_sessions
     set class_name=null,
         is_teaching_session=false,
         non_teaching_reason='DS / aucun TP',
         effective_session_index=null,
         class_occurrence=null,
         updated_at=now()
   where cycle_id=v_cycle_id
     and session_date in (date '2026-11-02',date '2026-11-05',date '2026-11-06');

  if exists(
    select 1
    from public.v515_assignments a
    join public.v515_sessions s on s.id=a.session_id
    where s.cycle_id=v_cycle_id
      and s.session_date in (date '2026-11-02',date '2026-11-05',date '2026-11-06')
  ) then
    raise exception 'DS_ASSIGNMENT_NOT_ALLOWED: DS rows unexpectedly contain assignments';
  end if;

  select count(*) into v_missing_classes
  from public.v515_assignments a
  join public.v515_sessions s on s.id=a.session_id
  left join public.classes c
    on c.name=s.class_name||'-G'||a.group_no
   and c.deleted_at is null
  where s.cycle_id=v_cycle_id
    and s.session_date in (
      date '2026-10-22',date '2026-10-29',date '2026-11-12',
      date '2026-11-19',date '2026-11-26',date '2026-12-03'
    )
    and c.id is null;

  if v_missing_classes>0 then
    raise exception 'TARGET_CLASS_MISSING: % corrected class/group target(s) missing',v_missing_classes;
  end if;

  -- Materialize the exact active plan remaps before handling historical unique-key
  -- conflicts. This keeps cleanup limited to the corrected Thursday rows only.
  create temporary table v16_plan_remap_targets(
    legacy_plan_id uuid primary key,
    target_class_id uuid not null,
    plan_date date not null
  ) on commit drop;

  insert into v16_plan_remap_targets(legacy_plan_id,target_class_id,plan_date)
  select a.legacy_plan_id,c.id,s.session_date
  from public.v515_assignments a
  join public.v515_sessions s on s.id=a.session_id
  join public.classes c
    on c.name=s.class_name||'-G'||a.group_no
   and c.deleted_at is null
  where s.cycle_id=v_cycle_id
    and s.session_date in (
      date '2026-10-22',date '2026-10-29',date '2026-11-12',
      date '2026-11-19',date '2026-11-26',date '2026-12-03'
    )
    and a.legacy_plan_id is not null;

  -- A historical soft-deleted row may still occupy UNIQUE(class_id,plan_date).
  -- Never remove it if it has started a session or is still referenced by V5.15.
  if exists(
    select 1
    from public.session_plans stale
    join v16_plan_remap_targets t
      on t.target_class_id=stale.class_id
     and t.plan_date=stale.plan_date
     and t.legacy_plan_id<>stale.id
    where stale.deleted_at is not null
      and (
        stale.session_id is not null
        or exists(
          select 1
          from public.v515_assignments dependency
          where dependency.legacy_plan_id=stale.id
        )
      )
  ) then
    raise exception 'SOFT_DELETED_PLAN_CONFLICT_HAS_REFERENCES: historical plan conflict is still referenced';
  end if;

  -- Physically remove only orphaned soft-deleted conflicts so the active plan can
  -- safely take the corrected class/date unique key.
  delete from public.session_plans stale
  using v16_plan_remap_targets t
  where t.target_class_id=stale.class_id
    and t.plan_date=stale.plan_date
    and t.legacy_plan_id<>stale.id
    and stale.deleted_at is not null
    and stale.session_id is null
    and not exists(
      select 1
      from public.v515_assignments dependency
      where dependency.legacy_plan_id=stale.id
    );

  update public.session_plans sp
     set class_id=t.target_class_id,
         revision=sp.revision+1,
         updated_at=now()
    from v16_plan_remap_targets t
   where t.legacy_plan_id=sp.id
     and sp.session_id is null
     and sp.deleted_at is null;

  if (select count(*) from public.v515_teacher_constraints where cycle_id=v_cycle_id)<>6 then
    raise exception 'TEACHER_POOL_INVALID: exactly six configured teachers are required';
  end if;

  for v_week in
    select distinct date_trunc('week',s.session_date)::date week_start
    from public.v515_sessions s
    where s.cycle_id=v_cycle_id
    order by 1
  loop
    select count(distinct s.session_date) into v_teaching_days
    from public.v515_sessions s
    where s.cycle_id=v_cycle_id
      and s.is_teaching_session
      and s.session_date between v_week.week_start and v_week.week_start+6;

    if v_teaching_days not in (0,2,3) then
      raise exception 'TEACHING_DAY_COUNT_UNSUPPORTED: week % has % teaching days',v_week.week_start,v_teaching_days;
    end if;

    if v_teaching_days=0 then
      if exists(
        select 1
        from public.v515_assignments a
        join public.v515_sessions s on s.id=a.session_id
        where s.cycle_id=v_cycle_id
          and s.session_date between v_week.week_start and v_week.week_start+6
      ) then
        raise exception 'DS_ASSIGNMENT_NOT_ALLOWED: week % contains assignments',v_week.week_start;
      end if;
      continue;
    end if;

    for v_day in
      select s.session_date,count(a.id) assignments,count(distinct a.teacher_id) teachers
      from public.v515_sessions s
      left join public.v515_assignments a on a.session_id=s.id
      where s.cycle_id=v_cycle_id
        and s.is_teaching_session
        and s.session_date between v_week.week_start and v_week.week_start+6
      group by s.session_date
    loop
      if v_day.assignments<>4 or v_day.teachers<>4 then
        raise exception 'DAY_TEACHER_COUNT: % has % assignments / % teachers',v_day.session_date,v_day.assignments,v_day.teachers;
      end if;
    end loop;

    if exists(
      select 1
      from public.v515_assignments a
      join public.v515_sessions s on s.id=a.session_id
      where s.cycle_id=v_cycle_id
        and s.is_teaching_session
        and s.session_date between v_week.week_start and v_week.week_start+6
      group by s.session_date,a.teacher_id
      having count(*)>1
    ) then
      raise exception 'TEACHER_DUPLICATE_DAY: week %',v_week.week_start;
    end if;

    for v_teacher in
      select c.teacher_id,count(distinct s.session_date) teaching_days
      from public.v515_teacher_constraints c
      left join public.v515_assignments a
        on a.cycle_id=c.cycle_id and a.teacher_id=c.teacher_id
      left join public.v515_sessions s
        on s.id=a.session_id
       and s.is_teaching_session
       and s.session_date between v_week.week_start and v_week.week_start+6
      where c.cycle_id=v_cycle_id
      group by c.teacher_id
    loop
      if v_teacher.teaching_days>2 then
        raise exception 'MAX_TWO_DAYS_PER_TEACHER: teacher % has % days in week %',v_teacher.teacher_id,v_teacher.teaching_days,v_week.week_start;
      end if;
      if v_teaching_days=3 and v_teacher.teaching_days<>2 then
        raise exception 'TEACHER_WEEKDAY_COUNT: teacher % has % days in normal week %',v_teacher.teacher_id,v_teacher.teaching_days,v_week.week_start;
      end if;
    end loop;

    if v_teaching_days=2 then
      select
        count(*) filter(where x.teaching_days=2),
        count(*) filter(where x.teaching_days=1),
        count(*) filter(where x.teaching_days=0)
        into v_two_days,v_one_day,v_zero_days
      from (
        select c.teacher_id,count(distinct s.session_date) teaching_days
        from public.v515_teacher_constraints c
        left join public.v515_assignments a
          on a.cycle_id=c.cycle_id and a.teacher_id=c.teacher_id
        left join public.v515_sessions s
          on s.id=a.session_id
         and s.is_teaching_session
         and s.session_date between v_week.week_start and v_week.week_start+6
        where c.cycle_id=v_cycle_id
        group by c.teacher_id
      ) x;

      if v_two_days<>2 or v_one_day<>4 or v_zero_days<>0 then
        raise exception 'HOLIDAY_WEEK_DISTRIBUTION: week % expected 2,2,1,1,1,1 but got two-day=% one-day=% zero-day=%',
          v_week.week_start,v_two_days,v_one_day,v_zero_days;
      end if;
    end if;
  end loop;

  insert into public.v515_audit_log(cycle_id,actor_id,event_type,error_code,message,context)
  values(
    v_cycle_id,
    auth.uid(),
    'v16_official_calendar_reconciled',
    null,
    'Calendrier officiel V16 réconcilié; appliquer ensuite le scénario TEST structurel.',
    jsonb_build_object(
      'holiday','2026-10-15',
      'ds_dates',jsonb_build_array('2026-11-02','2026-11-05','2026-11-06'),
      'next_step','public.v16_apply_test_teacher_plan(date)'
    )
  );
end;
$$;

commit;
