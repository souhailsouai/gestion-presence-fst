begin;

-- V16 allows the same manipulation in multiple rooms during one session.
alter table public.v515_assignments
  drop constraint if exists v515_assignments_session_id_manipulation_code_key;

alter table public.v16_test_assignments
  drop constraint if exists v16_test_assignments_test_session_id_manipulation_code_key;

-- Existing production rows may contain legacy duplicate room mappings. Do not
-- pre-validate those rows here. From this migration onward every touched row
-- is guarded transactionally, and V16 week saves touch all four group rows.
create or replace function private.v16_enforce_real_room_conflict()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  if tg_op='UPDATE' and new.room is not distinct from old.room and new.session_id is not distinct from old.session_id then
    return new;
  end if;
  if new.room is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('v16-real-room|' || new.session_id::text || '|' || new.room, 0)
  );

  if exists(
    select 1
    from public.v515_assignments a
    where a.session_id = new.session_id
      and a.room = new.room
      and a.id is distinct from new.id
  ) then
    raise exception using errcode='23505', message='ROOM_TIME_CONFLICT';
  end if;

  return new;
end;
$$;

create or replace function private.v16_enforce_test_room_conflict()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  if tg_op='UPDATE' and new.room is not distinct from old.room and new.test_session_id is not distinct from old.test_session_id then
    return new;
  end if;
  if new.room is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('v16-test-room|' || new.test_session_id::text || '|' || new.room, 0)
  );

  if exists(
    select 1
    from public.v16_test_assignments a
    where a.test_session_id = new.test_session_id
      and a.room = new.room
      and a.id is distinct from new.id
  ) then
    raise exception using errcode='23505', message='ROOM_TIME_CONFLICT';
  end if;

  return new;
end;
$$;

drop trigger if exists v16_real_room_conflict_guard on public.v515_assignments;
create constraint trigger v16_real_room_conflict_guard
after insert or update on public.v515_assignments
deferrable initially deferred
for each row execute function private.v16_enforce_real_room_conflict();

drop trigger if exists v16_test_room_conflict_guard on public.v16_test_assignments;
create constraint trigger v16_test_room_conflict_guard
after insert or update on public.v16_test_assignments
deferrable initially deferred
for each row execute function private.v16_enforce_test_room_conflict();

-- Strict per-class/per-group manipulation history.
create or replace function private.v16_enforce_real_group_manip_history()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_cycle_id uuid;
  v_class_name text;
begin
  select s.cycle_id, s.class_name
    into v_cycle_id, v_class_name
  from public.v515_sessions s
  where s.id = new.session_id;

  if v_cycle_id is null or v_class_name is null then
    return new;
  end if;

  if exists(
    select 1
    from public.v515_assignments a
    join public.v515_sessions s on s.id = a.session_id
    where s.cycle_id = v_cycle_id
      and s.class_name = v_class_name
      and a.group_no = new.group_no
      and a.manipulation_code = new.manipulation_code
      and a.id is distinct from new.id
  ) then
    raise exception using errcode='23514', message='REPEATED_GROUP_MANIPULATION';
  end if;

  return new;
end;
$$;

create or replace function private.v16_enforce_test_group_manip_history()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_class_name text;
begin
  select s.class_name
    into v_class_name
  from public.v16_test_sessions s
  where s.id = new.test_session_id;

  if v_class_name is null then
    return new;
  end if;

  if exists(
    select 1
    from public.v16_test_assignments a
    join public.v16_test_sessions s on s.id = a.test_session_id
    where s.class_name = v_class_name
      and a.group_no = new.group_no
      and a.manipulation_code = new.manipulation_code
      and a.id is distinct from new.id
  ) then
    raise exception using errcode='23514', message='REPEATED_GROUP_MANIPULATION';
  end if;

  return new;
end;
$$;

drop trigger if exists v16_real_group_manip_history_guard on public.v515_assignments;
create trigger v16_real_group_manip_history_guard
before insert or update of session_id, group_no, manipulation_code on public.v515_assignments
for each row execute function private.v16_enforce_real_group_manip_history();

drop trigger if exists v16_test_group_manip_history_guard on public.v16_test_assignments;
create trigger v16_test_group_manip_history_guard
before insert or update of test_session_id, group_no, manipulation_code on public.v16_test_assignments
for each row execute function private.v16_enforce_test_group_manip_history();

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
  v_teaching_days integer := 0;
  v_configured_teachers integer := 0;
  v_week_teachers integer := 0;
  v_two_days integer := 0;
  v_one_day integer := 0;
  v_zero_days integer := 0;
  v_day record;
  v_teacher record;
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
      'code','TEST_CONTEXT_USE_TEST_RPC',
      'message','Utiliser la validation TEST dédiée.',
      'week_start',p_week_start,
      'context',p_context,
      'blockers','[]'::jsonb
    );
  end if;

  select count(*) into v_configured_teachers
  from public.v515_teacher_constraints c
  where c.cycle_id=v_cycle_id;

  if v_configured_teachers<>6 then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
      'code','TEACHER_POOL_INVALID',
      'message','Le cycle doit contenir exactement 6 enseignants autorisés.',
      'teachers',v_configured_teachers
    ));
  end if;

  select count(distinct s.session_date) into v_teaching_days
  from public.v515_sessions s
  where s.cycle_id=v_cycle_id
    and s.is_teaching_session
    and s.session_date between p_week_start and (p_week_start+6);

  if v_teaching_days not in (0,2,3) then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
      'code','TEACHING_DAY_COUNT_UNSUPPORTED',
      'message','La semaine doit comporter 3 jours de TP, 2 jours après jour férié, ou 0 jour pendant les DS.',
      'teaching_days',v_teaching_days
    ));
  end if;

  if v_teaching_days=0 then
    if exists(
      select 1
      from public.v515_assignments a
      join public.v515_sessions s on s.id=a.session_id
      where s.cycle_id=v_cycle_id
        and s.session_date between p_week_start and (p_week_start+6)
    ) then
      v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
        'code','DS_ASSIGNMENT_NOT_ALLOWED',
        'message','La semaine DS ne doit contenir aucune affectation.'
      ));
    end if;

    return jsonb_build_object(
      'ok',jsonb_array_length(v_blockers)=0,
      'week_start',p_week_start,
      'context',p_context,
      'teaching_days',v_teaching_days,
      'blockers',v_blockers
    );
  end if;

  for v_day in
    select s.session_date,
           count(a.id) assignment_count,
           count(distinct a.teacher_id) teacher_count
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

  if exists(
    select 1
    from public.v515_assignments a
    join public.v515_sessions s on s.id=a.session_id
    left join public.v515_teacher_constraints c
      on c.cycle_id=v_cycle_id and c.teacher_id=a.teacher_id
    where s.cycle_id=v_cycle_id
      and s.is_teaching_session
      and s.session_date between p_week_start and (p_week_start+6)
      and c.teacher_id is null
  ) then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
      'code','TEACHER_NOT_CONFIGURED',
      'message','Une affectation utilise un enseignant hors du groupe des 6 enseignants autorisés.'
    ));
  end if;

  select count(distinct a.teacher_id) into v_week_teachers
  from public.v515_assignments a
  join public.v515_sessions s on s.id=a.session_id
  where s.cycle_id=v_cycle_id
    and s.is_teaching_session
    and s.session_date between p_week_start and (p_week_start+6);

  if v_week_teachers<>6 then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
      'code','WEEK_TEACHER_COUNT',
      'message','La semaine doit mobiliser exactement les 6 enseignants.',
      'teachers',v_week_teachers
    ));
  end if;

  for v_teacher in
    select c.teacher_id,
           count(distinct s.session_date) teaching_days
    from public.v515_teacher_constraints c
    left join public.v515_assignments a
      on a.cycle_id=c.cycle_id and a.teacher_id=c.teacher_id
    left join public.v515_sessions s
      on s.id=a.session_id
     and s.is_teaching_session
     and s.session_date between p_week_start and (p_week_start+6)
    where c.cycle_id=v_cycle_id
    group by c.teacher_id
  loop
    if v_teacher.teaching_days>2 then
      v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
        'code','MAX_TWO_DAYS_PER_TEACHER',
        'teacher_id',v_teacher.teacher_id,
        'days',v_teacher.teaching_days,
        'message','Aucun enseignant ne peut dépasser 2 jours de TP par semaine.'
      ));
    end if;

    if v_teaching_days=3 and v_teacher.teaching_days<>2 then
      v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
        'code','TEACHER_WEEKDAY_COUNT',
        'teacher_id',v_teacher.teacher_id,
        'days',v_teacher.teaching_days,
        'message','En semaine normale, chaque enseignant doit intervenir exactement 2 jours.'
      ));
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
       and s.session_date between p_week_start and (p_week_start+6)
      where c.cycle_id=v_cycle_id
      group by c.teacher_id
    ) x;

    if v_two_days<>2 or v_one_day<>4 or v_zero_days<>0 then
      v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
        'code','HOLIDAY_WEEK_DISTRIBUTION',
        'message','Semaine réduite : 2 enseignants doivent intervenir 2 jours et 4 enseignants 1 jour.',
        'two_day_teachers',v_two_days,
        'one_day_teachers',v_one_day,
        'zero_day_teachers',v_zero_days
      ));
    end if;
  end if;

  return jsonb_build_object(
    'ok',jsonb_array_length(v_blockers)=0,
    'week_start',p_week_start,
    'context',p_context,
    'teaching_days',v_teaching_days,
    'blockers',v_blockers
  );
end;
$$;

revoke execute on function public.v16_verify_teacher_week(date,text) from public,anon;
grant execute on function public.v16_verify_teacher_week(date,text) to authenticated;

create or replace function public.v16_save_week_plan(
  p_week_start date,
  p_rows jsonb,
  p_context text default 'real'
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_cycle_id uuid;
  v_expected_rows integer:=0;
  v_input_rows integer:=0;
  v_changed integer:=0;
  v_local_now timestamp:=timezone('Africa/Tunis',now());
  v_check jsonb;
  v_before jsonb:='[]'::jsonb;
  v_after jsonb:='[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not(select private.is_admin()) then
    return jsonb_build_object('ok',false,'code','FORBIDDEN','message','Accès Admin requis.');
  end if;
  if extract(isodow from p_week_start)<>1 then
    return jsonb_build_object('ok',false,'code','INVALID_WEEK_START','message','La semaine doit commencer un lundi.');
  end if;
  if p_context<>'real' then
    return jsonb_build_object('ok',false,'code','TEST_CONTEXT_USE_TEST_RPC','message','Utiliser la sauvegarde TEST dédiée.');
  end if;
  if p_rows is null or jsonb_typeof(p_rows)<>'array' then
    return jsonb_build_object('ok',false,'code','INVALID_ROWS','message','Les affectations doivent être fournies sous forme de tableau JSON.');
  end if;

  select c.id into v_cycle_id
  from public.v515_cycles c
  where c.academic_year='2026/2027' and c.semester=1
  limit 1;

  if v_cycle_id is null then
    return jsonb_build_object('ok',false,'code','CYCLE_NOT_FOUND','message','Planning 2026/2027 non initialisé.');
  end if;

  drop table if exists pg_temp.v16_week_input;
  create temporary table v16_week_input on commit drop as
  select r.session_id,r.group_no,r.teacher_id,r.manipulation_code,r.room
  from jsonb_to_recordset(p_rows) as r(
    session_id uuid,
    group_no integer,
    teacher_id uuid,
    manipulation_code text,
    room text
  );

  select count(*) into v_input_rows from pg_temp.v16_week_input;
  select count(*)*4 into v_expected_rows
  from public.v515_sessions s
  where s.cycle_id=v_cycle_id
    and s.is_teaching_session
    and s.session_date between p_week_start and (p_week_start+6);

  if v_input_rows<>v_expected_rows then
    return jsonb_build_object(
      'ok',false,'code','WEEK_ROWS_INCOMPLETE',
      'message','La semaine doit contenir exactement 4 lignes par séance de TP.',
      'expected',v_expected_rows,'received',v_input_rows
    );
  end if;

  if exists(
    select 1 from pg_temp.v16_week_input i
    left join public.v515_sessions s on s.id=i.session_id
    where s.id is null
       or s.cycle_id<>v_cycle_id
       or not s.is_teaching_session
       or s.session_date not between p_week_start and (p_week_start+6)
  ) then
    return jsonb_build_object('ok',false,'code','SESSION_OUTSIDE_WEEK','message','Une ligne ne correspond pas à une séance de TP de la semaine.');
  end if;

  if exists(
    select 1 from pg_temp.v16_week_input
    where group_no not between 1 and 4
       or manipulation_code not in ('M1','M2','M3','M4','M5','M6')
       or room not in ('A','B','C','D')
       or teacher_id is null
  ) then
    return jsonb_build_object('ok',false,'code','INVALID_ASSIGNMENT_VALUE','message','Groupe, enseignant, manipulation ou salle invalide.');
  end if;

  if exists(
    select 1
    from pg_temp.v16_week_input i
    left join public.v515_teacher_constraints c
      on c.cycle_id=v_cycle_id and c.teacher_id=i.teacher_id
    where c.teacher_id is null
  ) then
    return jsonb_build_object('ok',false,'code','TEACHER_NOT_CONFIGURED','message','L’enseignant choisi ne fait pas partie des 6 enseignants autorisés.');
  end if;

  if exists(
    select 1
    from pg_temp.v16_week_input
    group by session_id
    having count(*)<>4 or count(distinct group_no)<>4
  ) then
    return jsonb_build_object('ok',false,'code','SESSION_GROUPS_INCOMPLETE','message','Chaque séance doit contenir exactement G1, G2, G3 et G4.');
  end if;

  if exists(
    select 1
    from pg_temp.v16_week_input
    group by session_id,group_no
    having count(*)>1
  ) then
    return jsonb_build_object('ok',false,'code','DUPLICATE_GROUP_ROW','message','Un groupe apparaît plusieurs fois dans une séance.');
  end if;

  if exists(
    select 1
    from pg_temp.v16_week_input
    group by session_id,room
    having count(*)>1
  ) then
    return jsonb_build_object('ok',false,'code','ROOM_TIME_CONFLICT','message','Deux groupes simultanés ne peuvent pas utiliser la même salle.');
  end if;

  if exists(
    select 1
    from public.v515_sessions s
    where s.cycle_id=v_cycle_id
      and s.is_teaching_session
      and s.session_date between p_week_start and (p_week_start+6)
      and (s.lifecycle_status='completed' or v_local_now >= (s.session_date::timestamp+s.start_time))
  ) then
    return jsonb_build_object('ok',false,'code','SESSION_ALREADY_STARTED','message','Une séance de cette semaine a déjà commencé ou est terminée.');
  end if;

  if exists(
    select 1
    from public.v515_assignments a
    join public.v515_sessions s on s.id=a.session_id
    join public.session_plans sp on sp.id=a.legacy_plan_id
    where s.cycle_id=v_cycle_id
      and s.is_teaching_session
      and s.session_date between p_week_start and (p_week_start+6)
      and sp.session_id is not null
      and sp.deleted_at is null
  ) then
    return jsonb_build_object('ok',false,'code','SESSION_ALREADY_STARTED','message','Une séance de présence liée à cette semaine a déjà été démarrée.');
  end if;

  if exists(
    select 1
    from public.v515_sessions s
    left join public.v515_assignments a on a.session_id=s.id
    where s.cycle_id=v_cycle_id
      and s.is_teaching_session
      and s.session_date between p_week_start and (p_week_start+6)
    group by s.id
    having count(a.id)<>4
  ) then
    return jsonb_build_object('ok',false,'code','ASSIGNMENT_STRUCTURE_INCOMPLETE','message','La structure RÉELLE doit contenir 4 affectations par séance avant édition V16.');
  end if;

  perform 1
  from public.v515_sessions s
  where s.cycle_id=v_cycle_id
    and s.session_date between p_week_start and (p_week_start+6)
  for update;

  select coalesce(jsonb_agg(jsonb_build_object(
    'assignment_id',a.id,
    'session_id',a.session_id,
    'group_no',a.group_no,
    'teacher_id',a.teacher_id,
    'manipulation_code',a.manipulation_code,
    'room',a.room
  ) order by s.session_date,a.group_no),'[]'::jsonb)
  into v_before
  from public.v515_assignments a
  join public.v515_sessions s on s.id=a.session_id
  where s.cycle_id=v_cycle_id
    and s.is_teaching_session
    and s.session_date between p_week_start and (p_week_start+6);

  begin
    update public.v515_assignments a
    set teacher_id=i.teacher_id,
        manipulation_code=i.manipulation_code,
        room=i.room,
        source='admin_direct',
        request_id=null,
        assigned_by=auth.uid()
    from pg_temp.v16_week_input i
    where a.session_id=i.session_id
      and a.group_no=i.group_no;

    get diagnostics v_changed = row_count;

    update public.session_plans sp
       set teacher_id=a.teacher_id,
           manipulation=a.manipulation_code,
           room=a.room,
           revision=sp.revision+1,
           updated_at=now(),
           updated_by=auth.uid()
      from public.v515_assignments a
      join public.v515_sessions s on s.id=a.session_id
     where a.legacy_plan_id=sp.id
       and s.cycle_id=v_cycle_id
       and s.is_teaching_session
       and s.session_date between p_week_start and (p_week_start+6)
       and sp.session_id is null
       and sp.deleted_at is null;

    -- Force the deferred trigger now so the RPC can return a structured blocker.
    set constraints v16_real_room_conflict_guard immediate;

    v_check:=public.v16_verify_teacher_week(p_week_start,'real');
    if not coalesce((v_check->>'ok')::boolean,false) then
      raise exception using errcode='23514', message='V16_WEEK_VALIDATION_FAILED:'||v_check::text;
    end if;
  exception
    when unique_violation then
      return jsonb_build_object('ok',false,'code','ROOM_TIME_CONFLICT','message','Deux groupes simultanés ne peuvent pas utiliser la même salle.');
    when check_violation then
      if sqlerrm='REPEATED_GROUP_MANIPULATION' then
        return jsonb_build_object('ok',false,'code','REPEATED_GROUP_MANIPULATION','message','Un groupe ne peut pas refaire une manipulation déjà affectée dans son cycle.');
      elsif sqlerrm like 'V16_WEEK_VALIDATION_FAILED:%' then
        return jsonb_build_object(
          'ok',false,
          'code','WEEK_VALIDATION_FAILED',
          'message','La répartition hebdomadaire des enseignants est invalide.',
          'blockers',coalesce(v_check->'blockers','[]'::jsonb)
        );
      else
        raise;
      end if;
  end;

  select coalesce(jsonb_agg(jsonb_build_object(
    'assignment_id',a.id,
    'session_id',a.session_id,
    'group_no',a.group_no,
    'teacher_id',a.teacher_id,
    'manipulation_code',a.manipulation_code,
    'room',a.room
  ) order by s.session_date,a.group_no),'[]'::jsonb)
  into v_after
  from public.v515_assignments a
  join public.v515_sessions s on s.id=a.session_id
  where s.cycle_id=v_cycle_id
    and s.is_teaching_session
    and s.session_date between p_week_start and (p_week_start+6);

  perform private.v515_audit(
    v_cycle_id,
    'v16_manual_week_plan_saved',
    null,
    'Planning hebdomadaire V16 enregistré.',
    jsonb_build_object('week_start',p_week_start,'before',v_before,'after',v_after)
  );

  return jsonb_build_object(
    'ok',true,
    'week_start',p_week_start,
    'context','real',
    'changed_assignments',v_changed,
    'blockers','[]'::jsonb
  );
end;
$$;

revoke execute on function public.v16_save_week_plan(date,jsonb,text) from public,anon;
grant execute on function public.v16_save_week_plan(date,jsonb,text) to authenticated;

commit;
