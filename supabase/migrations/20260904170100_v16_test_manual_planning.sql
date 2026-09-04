begin;

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

  delete from public.v16_test_attendance;
  delete from public.v16_test_assignments;
  delete from public.v16_test_sessions;
  delete from public.v16_test_scenarios;

  insert into public.v16_test_sessions(
    context,real_session_id,session_date,start_time,end_time,class_name,lifecycle_status,created_by
  )
  select
    'test',s.id,s.session_date,s.start_time,s.end_time,s.class_name,s.lifecycle_status,auth.uid()
  from public.v515_sessions s
  where s.cycle_id=v_cycle_id
    and s.session_date>=p_effective_date
  order by s.session_date,s.start_time;
  get diagnostics v_sessions=row_count;

  insert into public.v16_test_assignments(
    context,test_session_id,real_assignment_id,group_no,manipulation_code,teacher_id,room,created_by
  )
  select
    'test',ts.id,a.id,a.group_no,a.manipulation_code,a.teacher_id,a.room,auth.uid()
  from public.v515_assignments a
  join public.v515_sessions s on s.id=a.session_id
  join public.v16_test_sessions ts on ts.real_session_id=s.id
  where a.cycle_id=v_cycle_id
    and s.session_date>=p_effective_date
  order by s.session_date,a.group_no;
  get diagnostics v_assignments=row_count;

  perform private.v515_audit(
    v_cycle_id,'v16_real_cloned_to_test',null,
    'Planning structurel RÉEL cloné vers TEST.',
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

create or replace function private.v16_verify_test_teacher_week(
  p_week_start date
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_blockers jsonb:='[]'::jsonb;
  v_teaching_days integer:=0;
  v_teacher_count integer:=0;
  v_two_days integer:=0;
  v_one_day integer:=0;
  v_zero_days integer:=0;
  v_day record;
  v_teacher record;
begin
  select count(distinct session_date) into v_teaching_days
  from public.v16_test_sessions
  where lifecycle_status<>'cancelled'
    and class_name is not null
    and session_date between p_week_start and p_week_start+6;

  if v_teaching_days not in (0,2,3) then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
      'code','TEACHING_DAY_COUNT_UNSUPPORTED','teaching_days',v_teaching_days,
      'message','La semaine TEST doit contenir 3 jours de TP, 2 jours après jour férié, ou 0 jour pendant les DS.'
    ));
  end if;

  if v_teaching_days=0 then
    if exists(
      select 1 from public.v16_test_assignments a
      join public.v16_test_sessions s on s.id=a.test_session_id
      where s.session_date between p_week_start and p_week_start+6
    ) then
      v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('code','DS_ASSIGNMENT_NOT_ALLOWED','message','La semaine DS TEST ne doit contenir aucune affectation.'));
    end if;
    return jsonb_build_object('ok',jsonb_array_length(v_blockers)=0,'week_start',p_week_start,'teaching_days',v_teaching_days,'blockers',v_blockers);
  end if;

  for v_day in
    select s.session_date,count(a.id) assignments,count(distinct a.teacher_id) teachers
    from public.v16_test_sessions s
    left join public.v16_test_assignments a on a.test_session_id=s.id
    where s.class_name is not null
      and s.lifecycle_status<>'cancelled'
      and s.session_date between p_week_start and p_week_start+6
    group by s.session_date
  loop
    if v_day.assignments<>4 or v_day.teachers<>4 then
      v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
        'code','DAY_TEACHER_COUNT','date',v_day.session_date,'assignments',v_day.assignments,'teachers',v_day.teachers,
        'message','Chaque jour TEST doit avoir exactement 4 enseignants distincts.'
      ));
    end if;
  end loop;

  if exists(
    select 1 from public.v16_test_assignments a
    join public.v16_test_sessions s on s.id=a.test_session_id
    where s.session_date between p_week_start and p_week_start+6
    group by s.session_date,a.teacher_id
    having count(*)>1
  ) then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('code','TEACHER_DUPLICATE_DAY','message','Un enseignant ne peut apparaître qu’une fois le même jour TEST.'));
  end if;

  for v_teacher in
    select teacher_id,count(distinct session_date) teaching_days
    from (
      select a.teacher_id,s.session_date
      from public.v16_test_assignments a
      join public.v16_test_sessions s on s.id=a.test_session_id
      where s.session_date between p_week_start and p_week_start+6
    ) q
    group by teacher_id
  loop
    if v_teacher.teaching_days>2 then
      v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
        'code','MAX_TWO_DAYS_PER_TEACHER','teacher_id',v_teacher.teacher_id,'days',v_teacher.teaching_days,
        'message','Aucun enseignant ne peut dépasser 2 jours de TP par semaine.'
      ));
    end if;
  end loop;

  select count(distinct teacher_id) into v_teacher_count
  from public.v16_test_assignments a
  join public.v16_test_sessions s on s.id=a.test_session_id
  where s.session_date between p_week_start and p_week_start+6;

  if v_teacher_count<>6 then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('code','WEEK_TEACHER_COUNT','teachers',v_teacher_count,'message','La semaine TEST doit mobiliser les 6 enseignants.'));
  end if;

  if v_teaching_days=3 then
    if exists(
      select 1
      from (
        select a.teacher_id,count(distinct s.session_date) teaching_days
        from public.v16_test_assignments a
        join public.v16_test_sessions s on s.id=a.test_session_id
        where s.session_date between p_week_start and p_week_start+6
        group by a.teacher_id
      ) x
      where x.teaching_days<>2
    ) then
      v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('code','TEACHER_WEEKDAY_COUNT','message','En semaine normale TEST, chaque enseignant doit intervenir exactement 2 jours.'));
    end if;
  elsif v_teaching_days=2 then
    select count(*) filter(where teaching_days=2),count(*) filter(where teaching_days=1),count(*) filter(where teaching_days=0)
      into v_two_days,v_one_day,v_zero_days
    from (
      select c.teacher_id,count(distinct s.session_date) teaching_days
      from public.v515_teacher_constraints c
      join public.v515_cycles cyc on cyc.id=c.cycle_id and cyc.academic_year='2026/2027' and cyc.semester=1
      left join public.v16_test_assignments a on a.teacher_id=c.teacher_id
      left join public.v16_test_sessions s on s.id=a.test_session_id and s.session_date between p_week_start and p_week_start+6
      group by c.teacher_id
    ) x;

    if v_two_days<>2 or v_one_day<>4 or v_zero_days<>0 then
      v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
        'code','HOLIDAY_WEEK_DISTRIBUTION','two_day_teachers',v_two_days,'one_day_teachers',v_one_day,'zero_day_teachers',v_zero_days,
        'message','Semaine réduite TEST : 2 enseignants doivent intervenir 2 jours et 4 enseignants 1 jour.'
      ));
    end if;
  end if;

  return jsonb_build_object('ok',jsonb_array_length(v_blockers)=0,'week_start',p_week_start,'teaching_days',v_teaching_days,'blockers',v_blockers);
end;
$$;

revoke execute on function private.v16_verify_test_teacher_week(date) from public,anon;
grant execute on function private.v16_verify_test_teacher_week(date) to authenticated;

create or replace function public.v16_save_test_week_plan(
  p_week_start date,
  p_rows jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_expected integer:=0;
  v_input integer:=0;
  v_changed integer:=0;
  v_check jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not(select private.is_admin()) then return jsonb_build_object('ok',false,'code','FORBIDDEN','message','Accès Admin requis.'); end if;
  if extract(isodow from p_week_start)<>1 then return jsonb_build_object('ok',false,'code','INVALID_WEEK_START','message','La semaine doit commencer un lundi.'); end if;
  if jsonb_typeof(p_rows)<>'array' then return jsonb_build_object('ok',false,'code','INVALID_ROWS','message','Affectations TEST invalides.'); end if;

  create temporary table v16_test_input(
    session_id uuid,group_no integer,teacher_id uuid,manipulation_code text,room text
  ) on commit drop;

  insert into v16_test_input
  select * from jsonb_to_recordset(p_rows) as x(session_id uuid,group_no integer,teacher_id uuid,manipulation_code text,room text);
  get diagnostics v_input=row_count;

  select count(*)*4 into v_expected
  from public.v16_test_sessions s
  where s.class_name is not null and s.lifecycle_status<>'cancelled'
    and s.session_date between p_week_start and p_week_start+6;

  if v_input<>v_expected then return jsonb_build_object('ok',false,'code','INCOMPLETE_WEEK','message','Le planning TEST doit contenir les 4 groupes de chaque séance de la semaine.','expected',v_expected,'received',v_input); end if;

  if exists(select 1 from v16_test_input where group_no not between 1 and 4 or teacher_id is null or manipulation_code not in ('M1','M2','M3','M4','M5','M6') or room not in ('A','B','C','D')) then
    return jsonb_build_object('ok',false,'code','INVALID_ROW','message','Enseignant, manipulation ou salle TEST invalide.');
  end if;

  if exists(select 1 from v16_test_input group by session_id,room having count(*)>1) then
    return jsonb_build_object('ok',false,'code','ROOM_TIME_CONFLICT','message','Deux groupes TEST ne peuvent pas utiliser la même salle.');
  end if;

  if exists(
    select 1 from v16_test_input i
    join public.v16_test_sessions s on s.id=i.session_id
    where s.session_date not between p_week_start and p_week_start+6 or s.class_name is null
  ) then return jsonb_build_object('ok',false,'code','SESSION_OUTSIDE_WEEK','message','Une séance TEST est hors de la semaine sélectionnée.'); end if;

  update public.v16_test_assignments a
  set teacher_id=i.teacher_id,manipulation_code=i.manipulation_code,room=i.room,updated_at=now()
  from v16_test_input i
  where a.test_session_id=i.session_id and a.group_no=i.group_no;
  get diagnostics v_changed=row_count;

  v_check:=private.v16_verify_test_teacher_week(p_week_start);
  if not coalesce((v_check->>'ok')::boolean,false) then
    raise exception 'V16_TEST_WEEK_VALIDATION_FAILED:%',v_check::text;
  end if;

  perform private.v515_audit(null,'v16_test_week_plan_saved',null,'Planning structurel TEST enregistré.',jsonb_build_object('week_start',p_week_start,'changed_assignments',v_changed));
  return jsonb_build_object('ok',true,'week_start',p_week_start,'context','test','changed_assignments',v_changed,'blockers','[]'::jsonb);
end;
$$;

revoke execute on function public.v16_save_test_week_plan(date,jsonb) from public,anon;
grant execute on function public.v16_save_test_week_plan(date,jsonb) to authenticated;

create or replace function public.v16_apply_test_teacher_plan(
  p_effective_date date
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_cycle_id uuid;
  v_local_now timestamp:=timezone('Africa/Tunis',now());
  v_affected integer:=0;
  v_week record;
  v_check jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not(select private.is_admin()) then return jsonb_build_object('ok',false,'code','FORBIDDEN','message','Accès Admin requis.','affected_sessions',0); end if;
  if p_effective_date is null then return jsonb_build_object('ok',false,'code','EFFECTIVE_DATE_REQUIRED','message','Date d’effet requise.','affected_sessions',0); end if;

  select id into v_cycle_id from public.v515_cycles where academic_year='2026/2027' and semester=1 limit 1;
  if v_cycle_id is null then return jsonb_build_object('ok',false,'code','CYCLE_NOT_FOUND','message','Planning RÉEL non initialisé.','affected_sessions',0); end if;

  if exists(
    select 1
    from public.v16_test_assignments ta
    join public.v515_assignments ra on ra.id=ta.real_assignment_id
    join public.v515_sessions rs on rs.id=ra.session_id
    where rs.session_date>=p_effective_date
      and (rs.lifecycle_status='completed' or v_local_now >= rs.session_date::timestamp+rs.start_time)
  ) then
    return jsonb_build_object('ok',false,'code','SESSION_ALREADY_STARTED','message','Une séance RÉEL déjà démarrée ou terminée ne peut pas être modifiée.','affected_sessions',0);
  end if;

  if exists(select 1 from public.v16_test_assignments where real_assignment_id is null) then
    return jsonb_build_object('ok',false,'code','UNMAPPED_TEST_ASSIGNMENT','message','Une affectation TEST ne correspond à aucune affectation RÉEL.','affected_sessions',0);
  end if;

  update public.v515_assignments ra
  set teacher_id=ta.teacher_id,
      manipulation_code=ta.manipulation_code,
      room=ta.room,
      source='admin_direct',
      request_id=null,
      assigned_by=auth.uid()
  from public.v16_test_assignments ta
  join public.v515_sessions rs on rs.id=(select a2.session_id from public.v515_assignments a2 where a2.id=ta.real_assignment_id)
  where ra.id=ta.real_assignment_id
    and rs.session_date>=p_effective_date
    and rs.lifecycle_status<>'completed'
    and v_local_now < rs.session_date::timestamp+rs.start_time;
  get diagnostics v_affected=row_count;

  update public.session_plans sp
  set teacher_id=ra.teacher_id,
      manipulation=ra.manipulation_code,
      room=ra.room,
      updated_at=now()
  from public.v515_assignments ra
  join public.v16_test_assignments ta on ta.real_assignment_id=ra.id
  join public.v515_sessions rs on rs.id=ra.session_id
  where sp.id=ra.legacy_plan_id
    and rs.session_date>=p_effective_date
    and rs.lifecycle_status<>'completed'
    and v_local_now < rs.session_date::timestamp+rs.start_time;

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

  perform private.v515_audit(v_cycle_id,'v16_test_structural_plan_applied',null,'Planning structurel TEST appliqué au RÉEL.',jsonb_build_object('effective_date',p_effective_date,'affected_assignments',v_affected));

  return jsonb_build_object('ok',true,'affected_sessions',v_affected,'effective_date',p_effective_date,'blockers','[]'::jsonb,'warnings','[]'::jsonb);
end;
$$;

revoke execute on function public.v16_apply_test_teacher_plan(date) from public,anon;
grant execute on function public.v16_apply_test_teacher_plan(date) to authenticated;

commit;
