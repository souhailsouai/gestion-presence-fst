begin;

create or replace function public.v16_swap_teachers(
  p_teacher_a uuid,
  p_day_a integer,
  p_teacher_b uuid,
  p_day_b integer,
  p_effective_date date,
  p_scope text,
  p_context text default 'real'
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_cycle_id uuid;
  v_week_start date := (p_effective_date - (extract(isodow from p_effective_date)::integer - 1));
  v_local_now timestamp := timezone('Africa/Tunis',now());
  v_blockers jsonb := '[]'::jsonb;
  v_week record;
  v_day record;
  v_teacher record;
  v_conflict record;
  v_teacher_count integer;
  v_changed integer := 0;
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
  if p_scope not in ('week','future') then
    return jsonb_build_object('ok',false,'code','INVALID_SCOPE','message','Portée invalide : week ou future attendu.');
  end if;
  if p_day_a not in (1,4,5) or p_day_b not in (1,4,5) or p_day_a=p_day_b then
    return jsonb_build_object('ok',false,'code','INVALID_DAY','message','Les jours doivent être lundi, jeudi ou vendredi et être différents.');
  end if;
  if p_teacher_a=p_teacher_b then
    return jsonb_build_object('ok',false,'code','INVALID_TEACHERS','message','Choisissez deux enseignants différents.');
  end if;

  select c.id into v_cycle_id
  from public.v515_cycles c
  where c.academic_year='2026/2027' and c.semester=1
  limit 1;
  if v_cycle_id is null then
    return jsonb_build_object('ok',false,'code','CYCLE_NOT_FOUND','message','Planning 2026/2027 non initialisé.');
  end if;

  if p_context='test' then
    return jsonb_build_object('ok',false,'code','TEST_CONTEXT_NOT_READY','message','Le contexte TEST sera activé par la migration V16 dédiée.');
  end if;

  if exists(
    select 1
    from public.v515_assignments a
    join public.v515_sessions s on s.id=a.session_id
    where s.cycle_id=v_cycle_id
      and (
        (a.teacher_id=p_teacher_a and extract(isodow from s.session_date)=p_day_a)
        or (a.teacher_id=p_teacher_b and extract(isodow from s.session_date)=p_day_b)
      )
      and (
        (p_scope='week' and s.session_date between v_week_start and v_week_start+6)
        or (p_scope='future' and s.session_date>=p_effective_date)
      )
      and v_local_now >= (s.session_date::timestamp+s.start_time)
  ) then
    return jsonb_build_object('ok',false,'code','SESSION_ALREADY_STARTED','message','Une séance ciblée a déjà commencé : permutation refusée.');
  end if;

  create temporary table v16_swap_candidate(
    assignment_id uuid primary key,
    session_id uuid not null,
    session_date date not null,
    start_time time not null,
    end_time time not null,
    old_teacher_id uuid not null,
    new_teacher_id uuid not null,
    legacy_plan_id uuid
  ) on commit drop;

  insert into v16_swap_candidate(assignment_id,session_id,session_date,start_time,end_time,old_teacher_id,new_teacher_id,legacy_plan_id)
  select a.id,a.session_id,s.session_date,s.start_time,s.end_time,a.teacher_id,
         case when a.teacher_id=p_teacher_a then p_teacher_b else p_teacher_a end,
         a.legacy_plan_id
  from public.v515_assignments a
  join public.v515_sessions s on s.id=a.session_id
  where s.cycle_id=v_cycle_id
    and s.is_teaching_session
    and (
      (a.teacher_id=p_teacher_a and extract(isodow from s.session_date)=p_day_a)
      or (a.teacher_id=p_teacher_b and extract(isodow from s.session_date)=p_day_b)
    )
    and (
      (p_scope='week' and s.session_date between v_week_start and v_week_start+6)
      or (p_scope='future' and s.session_date>=p_effective_date)
    );

  if not exists(select 1 from v16_swap_candidate where old_teacher_id=p_teacher_a)
     or not exists(select 1 from v16_swap_candidate where old_teacher_id=p_teacher_b) then
    return jsonb_build_object('ok',false,'code','SWAP_SOURCE_MISSING','message','Les deux enseignants doivent avoir des affectations à permuter dans la portée choisie.');
  end if;

  -- Validate the complete candidate state for every touched ISO week before any real UPDATE.
  for v_week in
    select distinct (c.session_date-(extract(isodow from c.session_date)::integer-1))::date as week_start
    from v16_swap_candidate c
  loop
    for v_day in
      select x.session_date,
             count(*) as assignment_count,
             count(distinct x.teacher_id) as teacher_count
      from (
        select s.session_date,
               coalesce(c.new_teacher_id,a.teacher_id) as teacher_id
        from public.v515_sessions s
        join public.v515_assignments a on a.session_id=s.id
        left join v16_swap_candidate c on c.assignment_id=a.id
        where s.cycle_id=v_cycle_id
          and s.is_teaching_session
          and s.session_date between v_week.week_start and v_week.week_start+6
      ) x
      group by x.session_date
    loop
      if v_day.assignment_count<>4 or v_day.teacher_count<>4 then
        v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
          'code','DAY_TEACHER_COUNT','date',v_day.session_date,
          'message','La permutation doit conserver exactement 4 enseignants distincts par jour.'
        ));
      end if;
    end loop;

    select count(distinct teacher_id) into v_teacher_count
    from (
      select coalesce(c.new_teacher_id,a.teacher_id) as teacher_id
      from public.v515_sessions s
      join public.v515_assignments a on a.session_id=s.id
      left join v16_swap_candidate c on c.assignment_id=a.id
      where s.cycle_id=v_cycle_id
        and s.is_teaching_session
        and s.session_date between v_week.week_start and v_week.week_start+6
    ) candidate_week;
    if v_teacher_count<>6 then
      v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
        'code','WEEK_TEACHER_COUNT','week_start',v_week.week_start,
        'message','La permutation doit conserver exactement 6 enseignants par semaine.'
      ));
    end if;

    for v_teacher in
      select teacher_id,count(distinct session_date) as teaching_days
      from (
        select s.session_date,coalesce(c.new_teacher_id,a.teacher_id) as teacher_id
        from public.v515_sessions s
        join public.v515_assignments a on a.session_id=s.id
        left join v16_swap_candidate c on c.assignment_id=a.id
        where s.cycle_id=v_cycle_id
          and s.is_teaching_session
          and s.session_date between v_week.week_start and v_week.week_start+6
      ) candidate_days
      group by teacher_id
      having count(distinct session_date)<>2
    loop
      v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
        'code','TEACHER_WEEKDAY_COUNT','teacher_id',v_teacher.teacher_id,
        'message','Chaque enseignant doit conserver exactement 2 jours de TP dans la semaine.'
      ));
    end loop;

    if exists(
      select 1
      from (
        select s.session_date,coalesce(c.new_teacher_id,a.teacher_id) as teacher_id
        from public.v515_sessions s
        join public.v515_assignments a on a.session_id=s.id
        left join v16_swap_candidate c on c.assignment_id=a.id
        where s.cycle_id=v_cycle_id
          and s.is_teaching_session
          and s.session_date between v_week.week_start and v_week.week_start+6
      ) candidate_duplicates
      group by session_date,teacher_id
      having count(*)>1
    ) then
      v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
        'code','TEACHER_DUPLICATE_DAY','week_start',v_week.week_start,
        'message','La permutation créerait un doublon enseignant le même jour.'
      ));
    end if;

    for v_conflict in
      with candidate as (
        select a.id,s.session_date,s.start_time,s.end_time,coalesce(c.new_teacher_id,a.teacher_id) as teacher_id
        from public.v515_assignments a
        join public.v515_sessions s on s.id=a.session_id
        left join v16_swap_candidate c on c.assignment_id=a.id
        where s.cycle_id=v_cycle_id
          and s.session_date between v_week.week_start and v_week.week_start+6
      )
      select distinct c1.teacher_id,c1.session_date
      from candidate c1
      join candidate c2 on c2.teacher_id=c1.teacher_id and c2.id<>c1.id and c2.session_date=c1.session_date
      where c1.start_time<c2.end_time and c1.end_time>c2.start_time
    loop
      v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
        'code','TEACHER_TIME_CONFLICT','teacher_id',v_conflict.teacher_id,'date',v_conflict.session_date,
        'message','La permutation créerait un conflit horaire.'
      ));
    end loop;
  end loop;

  if jsonb_array_length(v_blockers)>0 then
    return jsonb_build_object('ok',false,'code','WEEK_POLICY_VIOLATION','blockers',v_blockers);
  end if;

  perform pg_advisory_xact_lock(hashtextextended('v16-swap|'||v_cycle_id::text,0));

  update public.v515_assignments a
     set teacher_id=c.new_teacher_id,
         assigned_by=auth.uid(),
         source='admin_direct',
         request_id=null
    from v16_swap_candidate c
   where a.id=c.assignment_id;
  get diagnostics v_changed = row_count;

  update public.session_plans sp
     set teacher_id=c.new_teacher_id,updated_at=now()
    from v16_swap_candidate c
   where c.legacy_plan_id is not null and sp.id=c.legacy_plan_id;

  perform private.v515_audit(
    v_cycle_id,
    'v16_teacher_swap_applied',
    null,
    case when p_scope='week' then 'Permutation enseignants appliquée à une semaine.' else 'Permutation enseignants permanente appliquée aux séances futures.' end,
    jsonb_build_object(
      'teacher_a',p_teacher_a,'day_a',p_day_a,
      'teacher_b',p_teacher_b,'day_b',p_day_b,
      'effective_date',p_effective_date,'scope',p_scope,'context',p_context,'changed_assignments',v_changed
    )
  );

  return jsonb_build_object('ok',true,'scope',p_scope,'effective_date',p_effective_date,'changed_assignments',v_changed);
end;
$$;

revoke execute on function public.v16_swap_teachers(uuid,integer,uuid,integer,date,text,text) from public,anon;
grant execute on function public.v16_swap_teachers(uuid,integer,uuid,integer,date,text,text) to authenticated;

commit;
