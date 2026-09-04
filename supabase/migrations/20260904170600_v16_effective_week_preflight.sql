begin;

-- Validate the exact REAL state that would exist after a TEST -> REAL apply.
-- Dates before p_effective_date remain REAL; dates on/after it use TEST values.
create or replace function private.v16_verify_test_apply_week(
  p_week_start date,
  p_effective_date date
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_cycle_id uuid;
  v_blockers jsonb:='[]'::jsonb;
  v_teaching_days integer:=0;
  v_teacher_count integer:=0;
  v_two_days integer:=0;
  v_one_day integer:=0;
  v_zero_days integer:=0;
  v_day record;
  v_teacher record;
begin
  select id into v_cycle_id
  from public.v515_cycles
  where academic_year='2026/2027' and semester=1
  limit 1;

  if v_cycle_id is null then
    return jsonb_build_object(
      'ok',false,'week_start',p_week_start,'teaching_days',0,
      'blockers',jsonb_build_array(jsonb_build_object('code','CYCLE_NOT_FOUND','message','Planning RÉEL non initialisé.'))
    );
  end if;

  select count(distinct rs.session_date) into v_teaching_days
  from public.v515_sessions rs
  where rs.cycle_id=v_cycle_id
    and rs.is_teaching_session
    and rs.lifecycle_status<>'cancelled'
    and rs.session_date between p_week_start and p_week_start+6;

  if v_teaching_days not in (0,2,3) then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
      'code','TEACHING_DAY_COUNT_UNSUPPORTED','teaching_days',v_teaching_days,
      'message','La semaine doit contenir 3 jours de TP, 2 jours après jour férié, ou 0 jour pendant les DS.'
    ));
  end if;

  if v_teaching_days=0 then
    return jsonb_build_object('ok',jsonb_array_length(v_blockers)=0,'week_start',p_week_start,'teaching_days',0,'blockers',v_blockers);
  end if;

  for v_day in
    with candidate as (
      select rs.session_date,ra.teacher_id,ra.room
      from public.v515_assignments ra
      join public.v515_sessions rs on rs.id=ra.session_id
      where rs.cycle_id=v_cycle_id
        and rs.is_teaching_session
        and rs.session_date between p_week_start and p_week_start+6
        and rs.session_date < p_effective_date
      union all
      select rs.session_date,ta.teacher_id,ta.room
      from public.v16_test_assignments ta
      join public.v16_test_sessions ts on ts.id=ta.test_session_id
      join public.v515_sessions rs on rs.id=ts.real_session_id
      where rs.cycle_id=v_cycle_id
        and rs.is_teaching_session
        and rs.session_date between p_week_start and p_week_start+6
        and rs.session_date >= p_effective_date
    )
    select rs.session_date,count(c.teacher_id) assignments,count(distinct c.teacher_id) teachers
    from public.v515_sessions rs
    left join candidate c on c.session_date=rs.session_date
    where rs.cycle_id=v_cycle_id
      and rs.is_teaching_session
      and rs.lifecycle_status<>'cancelled'
      and rs.session_date between p_week_start and p_week_start+6
    group by rs.session_date
  loop
    if v_day.assignments<>4 or v_day.teachers<>4 then
      v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
        'code','DAY_TEACHER_COUNT','date',v_day.session_date,
        'assignments',v_day.assignments,'teachers',v_day.teachers,
        'message','Chaque jour doit avoir exactement 4 affectations et 4 enseignants distincts.'
      ));
    end if;
  end loop;

  if exists(
    with candidate as (
      select rs.session_date,ra.teacher_id,ra.room
      from public.v515_assignments ra
      join public.v515_sessions rs on rs.id=ra.session_id
      where rs.cycle_id=v_cycle_id and rs.is_teaching_session
        and rs.session_date between p_week_start and p_week_start+6
        and rs.session_date < p_effective_date
      union all
      select rs.session_date,ta.teacher_id,ta.room
      from public.v16_test_assignments ta
      join public.v16_test_sessions ts on ts.id=ta.test_session_id
      join public.v515_sessions rs on rs.id=ts.real_session_id
      where rs.cycle_id=v_cycle_id and rs.is_teaching_session
        and rs.session_date between p_week_start and p_week_start+6
        and rs.session_date >= p_effective_date
    )
    select 1 from candidate
    where room is null
  ) then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('code','ROOM_REQUIRED','message','Toutes les salles de la semaine prospective doivent être définies.'));
  end if;

  if exists(
    with candidate as (
      select rs.session_date,ra.teacher_id,ra.room
      from public.v515_assignments ra
      join public.v515_sessions rs on rs.id=ra.session_id
      where rs.cycle_id=v_cycle_id and rs.is_teaching_session
        and rs.session_date between p_week_start and p_week_start+6
        and rs.session_date < p_effective_date
      union all
      select rs.session_date,ta.teacher_id,ta.room
      from public.v16_test_assignments ta
      join public.v16_test_sessions ts on ts.id=ta.test_session_id
      join public.v515_sessions rs on rs.id=ts.real_session_id
      where rs.cycle_id=v_cycle_id and rs.is_teaching_session
        and rs.session_date between p_week_start and p_week_start+6
        and rs.session_date >= p_effective_date
    )
    select 1 from candidate
    where room is not null
    group by session_date,room
    having count(*)>1
  ) then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('code','ROOM_TIME_CONFLICT','message','Deux groupes simultanés ne peuvent pas utiliser la même salle.'));
  end if;

  if exists(
    with candidate as (
      select rs.session_date,ra.teacher_id,ra.room
      from public.v515_assignments ra
      join public.v515_sessions rs on rs.id=ra.session_id
      where rs.cycle_id=v_cycle_id and rs.is_teaching_session
        and rs.session_date between p_week_start and p_week_start+6
        and rs.session_date < p_effective_date
      union all
      select rs.session_date,ta.teacher_id,ta.room
      from public.v16_test_assignments ta
      join public.v16_test_sessions ts on ts.id=ta.test_session_id
      join public.v515_sessions rs on rs.id=ts.real_session_id
      where rs.cycle_id=v_cycle_id and rs.is_teaching_session
        and rs.session_date between p_week_start and p_week_start+6
        and rs.session_date >= p_effective_date
    )
    select 1
    from candidate c
    left join public.v515_teacher_constraints tc
      on tc.cycle_id=v_cycle_id and tc.teacher_id=c.teacher_id
    where tc.teacher_id is null
  ) then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('code','TEACHER_NOT_CONFIGURED','message','La semaine prospective contient un enseignant non autorisé.'));
  end if;

  if exists(
    with candidate as (
      select rs.session_date,ra.teacher_id,ra.room
      from public.v515_assignments ra
      join public.v515_sessions rs on rs.id=ra.session_id
      where rs.cycle_id=v_cycle_id and rs.is_teaching_session
        and rs.session_date between p_week_start and p_week_start+6
        and rs.session_date < p_effective_date
      union all
      select rs.session_date,ta.teacher_id,ta.room
      from public.v16_test_assignments ta
      join public.v16_test_sessions ts on ts.id=ta.test_session_id
      join public.v515_sessions rs on rs.id=ts.real_session_id
      where rs.cycle_id=v_cycle_id and rs.is_teaching_session
        and rs.session_date between p_week_start and p_week_start+6
        and rs.session_date >= p_effective_date
    )
    select 1 from candidate
    group by session_date,teacher_id
    having count(*)>1
  ) then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('code','TEACHER_DUPLICATE_DAY','message','Un enseignant ne peut être affecté qu’une fois le même jour.'));
  end if;

  for v_teacher in
    with candidate as (
      select rs.session_date,ra.teacher_id,ra.room
      from public.v515_assignments ra
      join public.v515_sessions rs on rs.id=ra.session_id
      where rs.cycle_id=v_cycle_id and rs.is_teaching_session
        and rs.session_date between p_week_start and p_week_start+6
        and rs.session_date < p_effective_date
      union all
      select rs.session_date,ta.teacher_id,ta.room
      from public.v16_test_assignments ta
      join public.v16_test_sessions ts on ts.id=ta.test_session_id
      join public.v515_sessions rs on rs.id=ts.real_session_id
      where rs.cycle_id=v_cycle_id and rs.is_teaching_session
        and rs.session_date between p_week_start and p_week_start+6
        and rs.session_date >= p_effective_date
    )
    select tc.teacher_id,count(distinct c.session_date) teaching_days
    from public.v515_teacher_constraints tc
    left join candidate c on c.teacher_id=tc.teacher_id
    where tc.cycle_id=v_cycle_id
    group by tc.teacher_id
  loop
    if v_teacher.teaching_days>2 then
      v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
        'code','MAX_TWO_DAYS_PER_TEACHER','teacher_id',v_teacher.teacher_id,'days',v_teacher.teaching_days,
        'message','Aucun enseignant ne peut dépasser 2 jours de TP par semaine.'
      ));
    end if;
  end loop;

  with candidate as (
    select rs.session_date,ra.teacher_id,ra.room
    from public.v515_assignments ra
    join public.v515_sessions rs on rs.id=ra.session_id
    where rs.cycle_id=v_cycle_id and rs.is_teaching_session
      and rs.session_date between p_week_start and p_week_start+6
      and rs.session_date < p_effective_date
    union all
    select rs.session_date,ta.teacher_id,ta.room
    from public.v16_test_assignments ta
    join public.v16_test_sessions ts on ts.id=ta.test_session_id
    join public.v515_sessions rs on rs.id=ts.real_session_id
    where rs.cycle_id=v_cycle_id and rs.is_teaching_session
      and rs.session_date between p_week_start and p_week_start+6
      and rs.session_date >= p_effective_date
  )
  select count(distinct teacher_id) into v_teacher_count from candidate;

  if v_teacher_count<>6 then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('code','WEEK_TEACHER_COUNT','teachers',v_teacher_count,'message','La semaine prospective doit mobiliser les 6 enseignants.'));
  end if;

  if v_teaching_days=3 then
    if exists(
      with candidate as (
        select rs.session_date,ra.teacher_id,ra.room
        from public.v515_assignments ra
        join public.v515_sessions rs on rs.id=ra.session_id
        where rs.cycle_id=v_cycle_id and rs.is_teaching_session
          and rs.session_date between p_week_start and p_week_start+6
          and rs.session_date < p_effective_date
        union all
        select rs.session_date,ta.teacher_id,ta.room
        from public.v16_test_assignments ta
        join public.v16_test_sessions ts on ts.id=ta.test_session_id
        join public.v515_sessions rs on rs.id=ts.real_session_id
        where rs.cycle_id=v_cycle_id and rs.is_teaching_session
          and rs.session_date between p_week_start and p_week_start+6
          and rs.session_date >= p_effective_date
      ), counts as (
        select tc.teacher_id,count(distinct c.session_date) teaching_days
        from public.v515_teacher_constraints tc
        left join candidate c on c.teacher_id=tc.teacher_id
        where tc.cycle_id=v_cycle_id
        group by tc.teacher_id
      )
      select 1 from counts where teaching_days<>2
    ) then
      v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('code','TEACHER_WEEKDAY_COUNT','message','En semaine normale, chacun des 6 enseignants doit intervenir exactement 2 jours.'));
    end if;
  elsif v_teaching_days=2 then
    with candidate as (
      select rs.session_date,ra.teacher_id,ra.room
      from public.v515_assignments ra
      join public.v515_sessions rs on rs.id=ra.session_id
      where rs.cycle_id=v_cycle_id and rs.is_teaching_session
        and rs.session_date between p_week_start and p_week_start+6
        and rs.session_date < p_effective_date
      union all
      select rs.session_date,ta.teacher_id,ta.room
      from public.v16_test_assignments ta
      join public.v16_test_sessions ts on ts.id=ta.test_session_id
      join public.v515_sessions rs on rs.id=ts.real_session_id
      where rs.cycle_id=v_cycle_id and rs.is_teaching_session
        and rs.session_date between p_week_start and p_week_start+6
        and rs.session_date >= p_effective_date
    ), counts as (
      select tc.teacher_id,count(distinct c.session_date) teaching_days
      from public.v515_teacher_constraints tc
      left join candidate c on c.teacher_id=tc.teacher_id
      where tc.cycle_id=v_cycle_id
      group by tc.teacher_id
    )
    select count(*) filter(where teaching_days=2),
           count(*) filter(where teaching_days=1),
           count(*) filter(where teaching_days=0)
      into v_two_days,v_one_day,v_zero_days
    from counts;

    if v_two_days<>2 or v_one_day<>4 or v_zero_days<>0 then
      v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
        'code','HOLIDAY_WEEK_DISTRIBUTION',
        'two_day_teachers',v_two_days,'one_day_teachers',v_one_day,'zero_day_teachers',v_zero_days,
        'message','Semaine réduite : répartition attendue 2,2,1,1,1,1.'
      ));
    end if;
  end if;

  return jsonb_build_object(
    'ok',jsonb_array_length(v_blockers)=0,
    'week_start',p_week_start,
    'effective_date',p_effective_date,
    'teaching_days',v_teaching_days,
    'blockers',v_blockers
  );
end;
$$;

revoke execute on function private.v16_verify_test_apply_week(date,date) from public,anon;
grant execute on function private.v16_verify_test_apply_week(date,date) to authenticated;

create or replace function public.v16_preview_test_apply(p_effective_date date)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_cycle_id uuid;
  v_local_now timestamp:=timezone('Africa/Tunis',now());
  v_blockers jsonb:='[]'::jsonb;
  v_week record;
  v_check jsonb;
  v_current integer:=0;
  v_proposed integer:=0;
  v_changes integer:=0;
  v_weeks integer:=0;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not(select private.is_admin()) then
    return jsonb_build_object('ok',false,'code','FORBIDDEN','message','Accès Admin requis.','blockers',jsonb_build_array(jsonb_build_object('code','FORBIDDEN','message','Accès Admin requis.')));
  end if;
  if p_effective_date is null then
    return jsonb_build_object('ok',false,'code','EFFECTIVE_DATE_REQUIRED','message','Date d’effet requise.','blockers',jsonb_build_array(jsonb_build_object('code','EFFECTIVE_DATE_REQUIRED','message','Date d’effet requise.')));
  end if;

  select id into v_cycle_id from public.v515_cycles where academic_year='2026/2027' and semester=1 limit 1;
  if v_cycle_id is null then
    return jsonb_build_object('ok',false,'code','CYCLE_NOT_FOUND','message','Planning RÉEL non initialisé.','blockers',jsonb_build_array(jsonb_build_object('code','CYCLE_NOT_FOUND','message','Planning RÉEL non initialisé.')));
  end if;

  select count(*) into v_proposed
  from public.v16_test_assignments ta
  join public.v16_test_sessions ts on ts.id=ta.test_session_id
  where ts.session_date>=p_effective_date;

  select count(*) into v_current
  from public.v16_test_assignments ta
  join public.v16_test_sessions ts on ts.id=ta.test_session_id
  join public.v515_assignments ra on ra.id=ta.real_assignment_id
  where ts.session_date>=p_effective_date;

  select count(*) into v_changes
  from public.v16_test_assignments ta
  join public.v16_test_sessions ts on ts.id=ta.test_session_id
  join public.v515_assignments ra on ra.id=ta.real_assignment_id
  where ts.session_date>=p_effective_date
    and (ta.teacher_id is distinct from ra.teacher_id or ta.manipulation_code is distinct from ra.manipulation_code or ta.room is distinct from ra.room);

  select count(distinct date_trunc('week',ts.session_date)::date) into v_weeks
  from public.v16_test_sessions ts
  where ts.class_name is not null and ts.session_date>=p_effective_date;

  if exists(
    select 1 from public.v16_test_sessions ts
    join public.v515_sessions rs on rs.id=ts.real_session_id
    where ts.session_date>=p_effective_date and rs.class_name is distinct from ts.class_name
  ) then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('code','REAL_CALENDAR_RECONCILIATION_REQUIRED','message','Réconcilier le calendrier RÉEL avant TEST → RÉEL.'));
  end if;

  if exists(
    select 1 from public.v16_test_assignments ta
    join public.v16_test_sessions ts on ts.id=ta.test_session_id
    where ts.session_date>=p_effective_date and ta.room is null
  ) then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('code','ROOM_REQUIRED','message','Toutes les salles TEST doivent être choisies.'));
  end if;

  if exists(
    select 1 from public.v16_test_assignments ta
    join public.v16_test_sessions ts on ts.id=ta.test_session_id
    left join public.v515_assignments ra on ra.id=ta.real_assignment_id
    where ts.session_date>=p_effective_date and (ta.real_assignment_id is null or ra.id is null)
  ) then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('code','UNMAPPED_TEST_ASSIGNMENT','message','Une affectation TEST ne correspond à aucune affectation RÉEL.'));
  end if;

  if exists(
    select 1
    from public.v16_test_assignments ta
    join public.v16_test_sessions ts on ts.id=ta.test_session_id
    join public.v515_assignments ra on ra.id=ta.real_assignment_id
    join public.v515_sessions rs on rs.id=ts.real_session_id
    left join public.session_plans sp on sp.id=ra.legacy_plan_id
    where ts.session_date>=p_effective_date
      and (rs.lifecycle_status='completed' or v_local_now >= (rs.session_date::timestamp+rs.start_time) or (sp.session_id is not null and sp.deleted_at is null))
  ) then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('code','SESSION_ALREADY_STARTED','message','Une séance RÉEL a déjà commencé ou est terminée.'));
  end if;

  if exists(
    select 1 from public.v16_test_assignments ta
    join public.v16_test_sessions ts on ts.id=ta.test_session_id
    left join public.v515_teacher_constraints c on c.cycle_id=v_cycle_id and c.teacher_id=ta.teacher_id
    where ts.session_date>=p_effective_date and c.teacher_id is null
  ) then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('code','TEACHER_NOT_CONFIGURED','message','Une affectation TEST utilise un enseignant non autorisé pour ce cycle.'));
  end if;

  if exists(
    select 1 from public.v16_test_assignments ta
    join public.v16_test_sessions ts on ts.id=ta.test_session_id
    where ts.session_date>=p_effective_date
    group by ts.class_name,ta.group_no,ta.manipulation_code
    having count(*)>1
  ) then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('code','REPEATED_GROUP_MANIPULATION','message','Un groupe TEST répète une manipulation dans la période proposée.'));
  end if;

  if exists(
    select 1
    from public.v16_test_assignments ta
    join public.v16_test_sessions ts on ts.id=ta.test_session_id
    join public.v515_assignments ra_old on ra_old.group_no=ta.group_no
    join public.v515_sessions rs_old on rs_old.id=ra_old.session_id
    where ts.session_date>=p_effective_date
      and rs_old.cycle_id=v_cycle_id
      and rs_old.class_name=ts.class_name
      and ra_old.manipulation_code=ta.manipulation_code
      and rs_old.session_date<ts.session_date
      and not exists(select 1 from public.v16_test_assignments ta_old where ta_old.real_assignment_id=ra_old.id)
  ) then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('code','REPEATED_GROUP_MANIPULATION','message','Un groupe TEST répéterait une manipulation déjà réalisée dans l’historique RÉEL.'));
  end if;

  for v_week in
    select distinct date_trunc('week',rs.session_date)::date week_start
    from public.v16_test_sessions ts
    join public.v515_sessions rs on rs.id=ts.real_session_id
    where rs.session_date>=p_effective_date
    order by 1
  loop
    v_check:=private.v16_verify_test_apply_week(v_week.week_start,p_effective_date);
    if not coalesce((v_check->>'ok')::boolean,false) then
      v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
        'code','TEST_WEEK_VALIDATION_FAILED','week_start',v_week.week_start,
        'message','La semaine prospective TEST → RÉEL est invalide.',
        'details',coalesce(v_check->'blockers','[]'::jsonb)
      ));
    end if;
  end loop;

  return jsonb_build_object(
    'ok',jsonb_array_length(v_blockers)=0,
    'effective_date',p_effective_date,
    'current_count',v_current,
    'proposed_count',v_proposed,
    'structural_changes',v_changes,
    'weeks',v_weeks,
    'blockers',v_blockers,
    'warnings','[]'::jsonb
  );
end;
$$;

revoke execute on function public.v16_preview_test_apply(date) from public,anon;
grant execute on function public.v16_preview_test_apply(date) to authenticated;

create or replace function public.v16_apply_test_teacher_plan(p_effective_date date)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_cycle_id uuid;
  v_local_now timestamp:=timezone('Africa/Tunis',now());
  v_week record;
  v_check jsonb;
  v_changed integer:=0;
  v_sessions integer:=0;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not(select private.is_admin()) then return jsonb_build_object('ok',false,'code','FORBIDDEN','message','Accès Admin requis.','affected_sessions',0); end if;
  if p_effective_date is null then return jsonb_build_object('ok',false,'code','EFFECTIVE_DATE_REQUIRED','message','Date d’effet requise.','affected_sessions',0); end if;

  select id into v_cycle_id from public.v515_cycles where academic_year='2026/2027' and semester=1 limit 1;
  if v_cycle_id is null then return jsonb_build_object('ok',false,'code','CYCLE_NOT_FOUND','message','Planning RÉEL non initialisé.','affected_sessions',0); end if;

  if exists(
    select 1 from public.v16_test_sessions ts
    join public.v515_sessions rs on rs.id=ts.real_session_id
    where ts.session_date>=p_effective_date and rs.class_name is distinct from ts.class_name
  ) then
    return jsonb_build_object('ok',false,'code','REAL_CALENDAR_RECONCILIATION_REQUIRED','message','Réconcilier le calendrier RÉEL avant TEST → RÉEL.','affected_sessions',0);
  end if;

  if exists(
    select 1 from public.v16_test_assignments ta
    join public.v16_test_sessions ts on ts.id=ta.test_session_id
    where ts.session_date>=p_effective_date and ta.room is null
  ) then
    return jsonb_build_object('ok',false,'code','ROOM_REQUIRED','message','Toutes les salles TEST doivent être choisies.','affected_sessions',0);
  end if;

  if exists(
    select 1 from public.v16_test_assignments ta
    join public.v16_test_sessions ts on ts.id=ta.test_session_id
    left join public.v515_assignments ra on ra.id=ta.real_assignment_id
    where ts.session_date>=p_effective_date and (ta.real_assignment_id is null or ra.id is null)
  ) then
    return jsonb_build_object('ok',false,'code','UNMAPPED_TEST_ASSIGNMENT','message','Une affectation TEST ne correspond à aucune affectation RÉEL.','affected_sessions',0);
  end if;

  if exists(
    select 1
    from public.v16_test_assignments ta
    join public.v16_test_sessions ts on ts.id=ta.test_session_id
    join public.v515_assignments ra on ra.id=ta.real_assignment_id
    join public.v515_sessions rs on rs.id=ts.real_session_id
    left join public.session_plans sp on sp.id=ra.legacy_plan_id
    where ts.session_date>=p_effective_date
      and (rs.lifecycle_status='completed' or v_local_now >= (rs.session_date::timestamp+rs.start_time) or (sp.session_id is not null and sp.deleted_at is null))
  ) then
    return jsonb_build_object('ok',false,'code','SESSION_ALREADY_STARTED','message','Une séance RÉEL a déjà commencé ou est terminée.','affected_sessions',0);
  end if;

  for v_week in
    select distinct date_trunc('week',rs.session_date)::date week_start
    from public.v16_test_sessions ts
    join public.v515_sessions rs on rs.id=ts.real_session_id
    where rs.session_date>=p_effective_date
    order by 1
  loop
    v_check:=private.v16_verify_test_apply_week(v_week.week_start,p_effective_date);
    if not coalesce((v_check->>'ok')::boolean,false) then
      return jsonb_build_object(
        'ok',false,'code','TEST_WEEK_VALIDATION_FAILED',
        'message','La semaine prospective TEST → RÉEL est invalide.',
        'affected_sessions',0,'blockers',coalesce(v_check->'blockers','[]'::jsonb)
      );
    end if;
  end loop;

  begin
    update public.v515_assignments ra
       set teacher_id=ta.teacher_id,
           manipulation_code=ta.manipulation_code,
           room=ta.room,
           source='admin_direct',
           request_id=null,
           assigned_by=auth.uid()
      from public.v16_test_assignments ta
      join public.v16_test_sessions ts on ts.id=ta.test_session_id
      join public.v515_sessions rs on rs.id=ts.real_session_id
     where ra.id=ta.real_assignment_id
       and rs.cycle_id=v_cycle_id
       and rs.session_date>=p_effective_date
       and rs.lifecycle_status<>'completed'
       and v_local_now < (rs.session_date::timestamp+rs.start_time);
    get diagnostics v_changed=row_count;

    update public.session_plans sp
       set teacher_id=ra.teacher_id,
           manipulation=ra.manipulation_code,
           room=ra.room,
           revision=sp.revision+1,
           updated_at=now(),
           updated_by=auth.uid()
      from public.v515_assignments ra
      join public.v515_sessions rs on rs.id=ra.session_id
     where ra.legacy_plan_id=sp.id
       and rs.cycle_id=v_cycle_id
       and rs.session_date>=p_effective_date
       and sp.session_id is null
       and sp.deleted_at is null;

    set constraints v16_real_room_conflict_guard immediate;

    for v_week in
      select distinct date_trunc('week',rs.session_date)::date week_start
      from public.v16_test_assignments ta
      join public.v16_test_sessions ts on ts.id=ta.test_session_id
      join public.v515_sessions rs on rs.id=ts.real_session_id
      where rs.session_date>=p_effective_date
      order by 1
    loop
      v_check:=public.v16_verify_teacher_week(v_week.week_start,'real');
      if not coalesce((v_check->>'ok')::boolean,false) then
        raise exception using errcode='23514',message='V16_WEEK_VALIDATION_FAILED:'||v_check::text;
      end if;
    end loop;
  exception
    when unique_violation then
      return jsonb_build_object('ok',false,'code','ROOM_TIME_CONFLICT','message','Conflit de salle lors de TEST → RÉEL.','affected_sessions',0);
    when check_violation then
      if sqlerrm='REPEATED_GROUP_MANIPULATION' then
        return jsonb_build_object('ok',false,'code','REPEATED_GROUP_MANIPULATION','message','Un groupe RÉEL répéterait une manipulation.','affected_sessions',0);
      elsif sqlerrm like 'V16_WEEK_VALIDATION_FAILED:%' then
        return jsonb_build_object('ok',false,'code','WEEK_VALIDATION_FAILED','message','Répartition hebdomadaire RÉELLE invalide.','affected_sessions',0,'blockers',coalesce(v_check->'blockers','[]'::jsonb));
      else raise;
      end if;
  end;

  select count(distinct rs.id) into v_sessions
  from public.v16_test_assignments ta
  join public.v16_test_sessions ts on ts.id=ta.test_session_id
  join public.v515_sessions rs on rs.id=ts.real_session_id
  where rs.session_date>=p_effective_date;

  perform private.v515_audit(
    v_cycle_id,'v16_test_structural_plan_applied',null,
    'Scénario TEST structurel appliqué au planning RÉEL.',
    jsonb_build_object('effective_date',p_effective_date,'affected_sessions',v_sessions,'changed_assignments',v_changed)
  );

  return jsonb_build_object('ok',true,'affected_sessions',v_sessions,'changed_assignments',v_changed,'effective_date',p_effective_date,'blockers','[]'::jsonb,'warnings','[]'::jsonb);
end;
$$;

revoke execute on function public.v16_apply_test_teacher_plan(date) from public,anon;
grant execute on function public.v16_apply_test_teacher_plan(date) to authenticated;

commit;
