begin;

create or replace function public.v16_apply_test_teacher_plan(
  p_effective_date date
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_local_now timestamp:=timezone('Africa/Tunis',now());
  v_blockers jsonb:='[]'::jsonb;
  v_warnings jsonb:='[]'::jsonb;
  v_affected integer:=0;
  v_cycle_id uuid;
  v_week record;
  v_check jsonb;
  v_bad record;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not(select private.is_admin()) then
    return jsonb_build_object('ok',false,'code','FORBIDDEN','message','Accès Admin requis.','affected_sessions',0,'effective_date',p_effective_date,'blockers','[]'::jsonb,'warnings','[]'::jsonb);
  end if;
  if p_effective_date is null then
    return jsonb_build_object('ok',false,'code','EFFECTIVE_DATE_REQUIRED','message','Date d’effet requise.','affected_sessions',0,'effective_date',p_effective_date,'blockers','[]'::jsonb,'warnings','[]'::jsonb);
  end if;

  select id into v_cycle_id from public.v515_cycles where academic_year='2026/2027' and semester=1 limit 1;
  if v_cycle_id is null then
    return jsonb_build_object('ok',false,'code','CYCLE_NOT_FOUND','message','Planning RÉEL non initialisé.','affected_sessions',0,'effective_date',p_effective_date,'blockers','[]'::jsonb,'warnings','[]'::jsonb);
  end if;

  if exists(
    select 1
    from public.v16_test_assignments ta
    join public.v515_assignments ra on ra.id=ta.real_assignment_id
    join public.v515_sessions rs on rs.id=ra.session_id
    where rs.session_date>=p_effective_date
      and (rs.lifecycle_status='completed' or v_local_now >= (rs.session_date::timestamp+rs.start_time))
  ) then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
      'code','SESSION_ALREADY_STARTED',
      'message','STARTED_SESSION : une séance RÉEL déjà démarrée ou completed ne peut pas être modifiée.'
    ));
  end if;

  if exists(select 1 from public.v16_test_assignments where real_assignment_id is null) then
    v_warnings:=v_warnings||jsonb_build_array(jsonb_build_object(
      'code','UNMAPPED_TEST_ASSIGNMENT',
      'message','Certaines affectations TEST ne correspondent à aucune affectation RÉEL et seront ignorées.'
    ));
  end if;

  create temporary table v16_candidate_assignments on commit drop as
  select
    ra.id assignment_id,
    ra.session_id,
    rs.session_date,
    rs.start_time,
    rs.end_time,
    ra.group_no,
    case
      when rs.session_date>=p_effective_date
       and rs.lifecycle_status<>'completed'
       and v_local_now < (rs.session_date::timestamp+rs.start_time)
      then coalesce(ta.teacher_id,ra.teacher_id)
      else ra.teacher_id
    end as teacher_id
  from public.v515_assignments ra
  join public.v515_sessions rs on rs.id=ra.session_id
  left join public.v16_test_assignments ta on ta.real_assignment_id=ra.id
  where ra.cycle_id=v_cycle_id;

  for v_bad in
    select session_date,count(*) assignments,count(distinct teacher_id) teachers
    from v16_candidate_assignments
    where session_date>=p_effective_date
    group by session_date
    having count(*)<>4 or count(distinct teacher_id)<>4
  loop
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
      'code','DAY_TEACHER_COUNT','date',v_bad.session_date,
      'message','Chaque jour de TP doit conserver 4 enseignants distincts.',
      'assignments',v_bad.assignments,'teachers',v_bad.teachers
    ));
  end loop;

  if exists(
    select 1 from v16_candidate_assignments
    where session_date>=p_effective_date
    group by session_date,teacher_id
    having count(*)>1
  ) then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('code','TEACHER_DUPLICATE_DAY','message','Un enseignant apparaît plusieurs fois le même jour dans le scénario proposé.'));
  end if;

  for v_week in
    select distinct date_trunc('week',session_date)::date week_start
    from v16_candidate_assignments
    where session_date>=p_effective_date
    order by 1
  loop
    if (select count(distinct teacher_id) from v16_candidate_assignments where session_date between v_week.week_start and v_week.week_start+6)<>6 then
      v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('code','WEEK_TEACHER_COUNT','week_start',v_week.week_start,'message','La semaine proposée doit mobiliser exactement 6 enseignants.'));
    end if;
    for v_bad in
      select teacher_id,count(distinct session_date) teaching_days
      from v16_candidate_assignments
      where session_date between v_week.week_start and v_week.week_start+6
      group by teacher_id
      having count(distinct session_date)<>2
    loop
      v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('code','TEACHER_WEEKDAY_COUNT','week_start',v_week.week_start,'teacher_id',v_bad.teacher_id,'days',v_bad.teaching_days,'message','Chaque enseignant doit intervenir exactement 2 jours dans la semaine proposée.'));
    end loop;
  end loop;

  if jsonb_array_length(v_blockers)>0 then
    return jsonb_build_object(
      'ok',false,'code','VALIDATION_FAILED','message','Le scénario TEST ne peut pas être appliqué au RÉEL.',
      'affected_sessions',0,'effective_date',p_effective_date,'blockers',v_blockers,'warnings',v_warnings
    );
  end if;

  with changed as (
    update public.v515_assignments ra
    set teacher_id=ta.teacher_id,
        source='admin_direct',
        request_id=null,
        assigned_by=auth.uid()
    from public.v16_test_assignments ta
    join public.v515_sessions rs on rs.id=(select x.session_id from public.v515_assignments x where x.id=ta.real_assignment_id)
    where ra.id=ta.real_assignment_id
      and rs.session_date>=p_effective_date
      and rs.lifecycle_status<>'completed'
      and v_local_now < (rs.session_date::timestamp+rs.start_time)
      and ra.teacher_id is distinct from ta.teacher_id
    returning ra.id,ra.legacy_plan_id,ra.teacher_id
  )
  select count(*) into v_affected from changed;

  update public.session_plans sp
  set teacher_id=ra.teacher_id,updated_at=now()
  from public.v515_assignments ra
  where ra.legacy_plan_id=sp.id
    and exists(
      select 1 from public.v16_test_assignments ta
      join public.v515_sessions rs on rs.id=ra.session_id
      where ta.real_assignment_id=ra.id
        and rs.session_date>=p_effective_date
        and rs.lifecycle_status<>'completed'
        and v_local_now < (rs.session_date::timestamp+rs.start_time)
    );

  for v_week in
    select distinct date_trunc('week',rs.session_date)::date week_start
    from public.v16_test_assignments ta
    join public.v515_assignments ra on ra.id=ta.real_assignment_id
    join public.v515_sessions rs on rs.id=ra.session_id
    where rs.session_date>=p_effective_date
    order by 1
  loop
    v_check:=public.v16_verify_teacher_week(v_week.week_start,'real');
    if not coalesce((v_check->>'ok')::boolean,false) then
      raise exception 'V16_WEEK_VALIDATION_FAILED:%',v_check::text;
    end if;
  end loop;

  perform private.v515_audit(
    v_cycle_id,
    'v16_test_teacher_plan_applied',
    null,
    'Scénario TEST enseignant appliqué au planning RÉEL.',
    jsonb_build_object('effective_date',p_effective_date,'affected_sessions',v_affected,'warnings',v_warnings)
  );

  return jsonb_build_object(
    'ok',true,
    'affected_sessions',v_affected,
    'effective_date',p_effective_date,
    'blockers','[]'::jsonb,
    'warnings',v_warnings
  );
end;
$$;

revoke execute on function public.v16_apply_test_teacher_plan(date) from public,anon;
grant execute on function public.v16_apply_test_teacher_plan(date) to authenticated;

commit;
