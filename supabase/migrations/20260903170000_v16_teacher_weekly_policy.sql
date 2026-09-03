begin;

create or replace function public.v16_verify_teacher_week(
  p_week_start date,
  p_context text default 'real'
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_cycle_id uuid;
  v_blockers jsonb := '[]'::jsonb;
  v_day record;
  v_teacher record;
  v_conflict record;
  v_teacher_count integer;
  v_local_now timestamp := timezone('Africa/Tunis',now());
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  if not (select private.is_admin()) then
    return jsonb_build_object('ok',false,'code','FORBIDDEN','message','Accès Admin requis.');
  end if;
  if p_context not in ('real','test') then
    return jsonb_build_object('ok',false,'code','INVALID_CONTEXT','message','Contexte invalide.');
  end if;
  if extract(isodow from p_week_start) <> 1 then
    return jsonb_build_object('ok',false,'code','INVALID_WEEK_START','message','La semaine doit commencer un lundi.');
  end if;

  select c.id into v_cycle_id
  from public.v515_cycles c
  where c.academic_year='2026/2027' and c.semester=1
  limit 1;

  if v_cycle_id is null then
    return jsonb_build_object('ok',false,'code','CYCLE_NOT_FOUND','message','Planning 2026/2027 non initialisé.');
  end if;

  if p_context='test' then
    return jsonb_build_object(
      'ok',false,
      'code','TEST_CONTEXT_NOT_READY',
      'message','Le contexte TEST sera activé par la migration V16 dédiée.',
      'week_start',p_week_start
    );
  end if;

  for v_day in
    select
      s.session_date,
      count(a.id) as assignment_count,
      count(distinct a.teacher_id) as teacher_count
    from public.v515_sessions s
    left join public.v515_assignments a on a.session_id=s.id
    where s.cycle_id=v_cycle_id
      and s.is_teaching_session
      and s.session_date between p_week_start and (p_week_start+6)
    group by s.session_date
    order by s.session_date
  loop
    if v_day.assignment_count<>4 or v_day.teacher_count<>4 then
      v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
        'code','DAY_TEACHER_COUNT',
        'date',v_day.session_date,
        'message','Chaque jour de TP doit avoir exactement 4 enseignants distincts.',
        'assignments',v_day.assignment_count,
        'teachers',v_day.teacher_count
      ));
    end if;
  end loop;

  if exists(
    select 1
    from public.v515_assignments a
    join public.v515_sessions s on s.id=a.session_id
    where s.cycle_id=v_cycle_id
      and s.is_teaching_session
      and s.session_date between p_week_start and (p_week_start+6)
    group by s.session_date,a.teacher_id
    having count(*)>1
  ) then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
      'code','TEACHER_DUPLICATE_DAY',
      'message','Un enseignant ne peut apparaître qu’une fois le même jour.'
    ));
  end if;

  select count(distinct teacher_id) into v_teacher_count
  from (
    select a.teacher_id
    from public.v515_assignments a
    join public.v515_sessions s on s.id=a.session_id
    where s.cycle_id=v_cycle_id
      and s.is_teaching_session
      and s.session_date between p_week_start and (p_week_start+6)
  ) week_teachers;

  if v_teacher_count<>6 then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
      'code','WEEK_TEACHER_COUNT',
      'message','La semaine doit mobiliser exactement 6 enseignants.',
      'teachers',v_teacher_count
    ));
  end if;

  for v_teacher in
    select teacher_id,count(distinct session_date) as teaching_days
    from (
      select a.teacher_id,s.session_date
      from public.v515_assignments a
      join public.v515_sessions s on s.id=a.session_id
      where s.cycle_id=v_cycle_id
        and s.is_teaching_session
        and s.session_date between p_week_start and (p_week_start+6)
    ) teacher_days
    group by teacher_id
    having count(distinct session_date)<>2
  loop
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
      'code','TEACHER_WEEKDAY_COUNT',
      'teacher_id',v_teacher.teacher_id,
      'days',v_teacher.teaching_days,
      'message','Chaque enseignant doit intervenir exactement 2 jours par semaine.'
    ));
  end loop;

  for v_conflict in
    select distinct a1.teacher_id,s1.session_date
    from public.v515_assignments a1
    join public.v515_sessions s1 on s1.id=a1.session_id
    join public.v515_assignments a2 on a2.teacher_id=a1.teacher_id and a2.id<>a1.id
    join public.v515_sessions s2 on s2.id=a2.session_id and s2.session_date=s1.session_date
    where s1.cycle_id=v_cycle_id
      and s2.cycle_id=v_cycle_id
      and s1.session_date between p_week_start and (p_week_start+6)
      and s1.start_time<s2.end_time
      and s1.end_time>s2.start_time
  loop
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
      'code','TEACHER_TIME_CONFLICT',
      'teacher_id',v_conflict.teacher_id,
      'date',v_conflict.session_date,
      'message','Enseignant affecté sur deux créneaux qui se chevauchent.'
    ));
  end loop;

  if exists(
    select 1
    from public.v515_sessions s
    where s.cycle_id=v_cycle_id
      and s.is_teaching_session
      and s.session_date between p_week_start and (p_week_start+6)
      and v_local_now >= (s.session_date::timestamp+s.start_time)
  ) then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
      'code','SESSION_ALREADY_STARTED',
      'message','Une ou plusieurs séances de cette semaine ont déjà commencé et sont protégées.'
    ));
  end if;

  perform private.v515_audit(
    v_cycle_id,
    'v16_teacher_week_verified',
    null,
    'Vérification V16 de la répartition hebdomadaire des enseignants.',
    jsonb_build_object('week_start',p_week_start,'context',p_context,'blocker_count',jsonb_array_length(v_blockers))
  );

  return jsonb_build_object(
    'ok',jsonb_array_length(v_blockers)=0,
    'week_start',p_week_start,
    'context',p_context,
    'blockers',v_blockers
  );
end;
$$;

revoke execute on function public.v16_verify_teacher_week(date,text) from public,anon;
grant execute on function public.v16_verify_teacher_week(date,text) to authenticated;

commit;
