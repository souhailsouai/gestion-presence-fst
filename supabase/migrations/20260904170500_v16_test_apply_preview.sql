begin;

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

  select id into v_cycle_id
  from public.v515_cycles
  where academic_year='2026/2027' and semester=1
  limit 1;

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
    and (
      ta.teacher_id is distinct from ra.teacher_id
      or ta.manipulation_code is distinct from ra.manipulation_code
      or ta.room is distinct from ra.room
    );

  select count(distinct date_trunc('week',ts.session_date)::date) into v_weeks
  from public.v16_test_sessions ts
  where ts.class_name is not null
    and ts.session_date>=p_effective_date;

  if exists(
    select 1
    from public.v16_test_sessions ts
    join public.v515_sessions rs on rs.id=ts.real_session_id
    where ts.session_date>=p_effective_date
      and rs.class_name is distinct from ts.class_name
  ) then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
      'code','REAL_CALENDAR_RECONCILIATION_REQUIRED',
      'message','Réconcilier le calendrier RÉEL avant TEST → RÉEL.'
    ));
  end if;

  if exists(
    select 1
    from public.v16_test_assignments ta
    join public.v16_test_sessions ts on ts.id=ta.test_session_id
    where ts.session_date>=p_effective_date
      and ta.room is null
  ) then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
      'code','ROOM_REQUIRED',
      'message','Toutes les salles TEST doivent être choisies.'
    ));
  end if;

  if exists(
    select 1
    from public.v16_test_assignments ta
    join public.v16_test_sessions ts on ts.id=ta.test_session_id
    left join public.v515_assignments ra on ra.id=ta.real_assignment_id
    where ts.session_date>=p_effective_date
      and (ta.real_assignment_id is null or ra.id is null)
  ) then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
      'code','UNMAPPED_TEST_ASSIGNMENT',
      'message','Une affectation TEST ne correspond à aucune affectation RÉEL.'
    ));
  end if;

  if exists(
    select 1
    from public.v16_test_assignments ta
    join public.v16_test_sessions ts on ts.id=ta.test_session_id
    join public.v515_assignments ra on ra.id=ta.real_assignment_id
    join public.v515_sessions rs on rs.id=ts.real_session_id
    left join public.session_plans sp on sp.id=ra.legacy_plan_id
    where ts.session_date>=p_effective_date
      and (
        rs.lifecycle_status='completed'
        or v_local_now >= (rs.session_date::timestamp+rs.start_time)
        or (sp.session_id is not null and sp.deleted_at is null)
      )
  ) then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
      'code','SESSION_ALREADY_STARTED',
      'message','Une séance RÉEL a déjà commencé ou est terminée.'
    ));
  end if;

  if exists(
    select 1
    from public.v16_test_assignments ta
    join public.v16_test_sessions ts on ts.id=ta.test_session_id
    left join public.v515_teacher_constraints c
      on c.cycle_id=v_cycle_id and c.teacher_id=ta.teacher_id
    where ts.session_date>=p_effective_date
      and c.teacher_id is null
  ) then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
      'code','TEACHER_NOT_CONFIGURED',
      'message','Une affectation TEST utilise un enseignant non autorisé pour ce cycle.'
    ));
  end if;

  if exists(
    select 1
    from public.v16_test_assignments ta
    join public.v16_test_sessions ts on ts.id=ta.test_session_id
    where ts.session_date>=p_effective_date
    group by ts.class_name,ta.group_no,ta.manipulation_code
    having count(*)>1
  ) then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
      'code','REPEATED_GROUP_MANIPULATION',
      'message','Un groupe TEST répète une manipulation dans la période proposée.'
    ));
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
      and not exists(
        select 1
        from public.v16_test_assignments ta_old
        where ta_old.real_assignment_id=ra_old.id
      )
  ) then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
      'code','REPEATED_GROUP_MANIPULATION',
      'message','Un groupe TEST répéterait une manipulation déjà réalisée dans l’historique RÉEL.'
    ));
  end if;

  for v_week in
    select distinct date_trunc('week',s.session_date)::date week_start
    from public.v16_test_sessions s
    where s.class_name is not null
      and s.session_date>=p_effective_date
    order by 1
  loop
    v_check:=private.v16_verify_test_teacher_week(v_week.week_start);
    if not coalesce((v_check->>'ok')::boolean,false) then
      v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
        'code','TEST_WEEK_VALIDATION_FAILED',
        'week_start',v_week.week_start,
        'message','Le scénario TEST contient une semaine invalide.',
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

commit;
