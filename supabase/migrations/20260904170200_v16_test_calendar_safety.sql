begin;

-- TEST is a draft workspace: rooms are deliberately unresolved until Admin chooses them.
alter table public.v16_test_assignments alter column room drop not null;

create or replace function private.v16_official_occurrence(p_date date)
returns integer
language sql
immutable
security invoker
set search_path=''
as $$
  select case p_date
    when date '2026-09-14' then 1 when date '2026-09-21' then 1
    when date '2026-09-28' then 2 when date '2026-10-05' then 2
    when date '2026-10-12' then 3 when date '2026-10-19' then 3
    when date '2026-10-26' then 4 when date '2026-11-09' then 4
    when date '2026-11-16' then 5 when date '2026-11-23' then 5
    when date '2026-11-30' then 6

    when date '2026-09-17' then 1 when date '2026-09-24' then 1
    when date '2026-10-01' then 2 when date '2026-10-08' then 2
    when date '2026-10-22' then 3 when date '2026-10-29' then 3
    when date '2026-11-12' then 4 when date '2026-11-19' then 4
    when date '2026-11-26' then 5 when date '2026-12-03' then 5

    when date '2026-09-18' then 1 when date '2026-09-25' then 1
    when date '2026-10-02' then 2 when date '2026-10-09' then 2
    when date '2026-10-16' then 3 when date '2026-10-23' then 3
    when date '2026-10-30' then 4 when date '2026-11-13' then 4
    when date '2026-11-20' then 5 when date '2026-11-27' then 5
    when date '2026-12-04' then 6
    else null
  end;
$$;

create or replace function private.v16_official_manipulation(p_date date,p_group_no integer)
returns text
language plpgsql
immutable
security invoker
set search_path=''
as $$
declare
  v_occ integer:=private.v16_official_occurrence(p_date);
  v_pattern text[];
begin
  if p_group_no not between 1 and 4 or v_occ is null then return null; end if;
  v_pattern:=case v_occ
    when 1 then array['M1','M2','M3','M4']::text[]
    when 2 then array['M2','M3','M4','M1']::text[]
    when 3 then array['M3','M4','M1','M2']::text[]
    when 4 then array['M4','M1','M2','M3']::text[]
    when 5 then array['M5','M6','M5','M6']::text[]
    when 6 then array['M6','M5','M6','M5']::text[]
  end;
  return v_pattern[p_group_no];
end;
$$;

create or replace function private.v16_enforce_test_teacher_allowed()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
declare v_cycle_id uuid;
begin
  select id into v_cycle_id from public.v515_cycles where academic_year='2026/2027' and semester=1 limit 1;
  if v_cycle_id is null or not exists(
    select 1 from public.v515_teacher_constraints c
    where c.cycle_id=v_cycle_id and c.teacher_id=new.teacher_id
  ) then
    raise exception using errcode='23514',message='TEACHER_NOT_CONFIGURED';
  end if;
  return new;
end;
$$;

drop trigger if exists v16_test_teacher_allowed_guard on public.v16_test_assignments;
create trigger v16_test_teacher_allowed_guard
before insert or update of teacher_id on public.v16_test_assignments
for each row execute function private.v16_enforce_test_teacher_allowed();

-- Extend TEST manipulation history with REAL history that predates the cloned window.
create or replace function private.v16_enforce_test_group_manip_history()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_class_name text;
  v_session_date date;
begin
  select s.class_name,s.session_date into v_class_name,v_session_date
  from public.v16_test_sessions s where s.id=new.test_session_id;
  if v_class_name is null then return new; end if;

  if exists(
    select 1
    from public.v16_test_assignments a
    join public.v16_test_sessions s on s.id=a.test_session_id
    where s.class_name=v_class_name
      and a.group_no=new.group_no
      and a.manipulation_code=new.manipulation_code
      and a.id is distinct from new.id
  ) then
    raise exception using errcode='23514',message='REPEATED_GROUP_MANIPULATION';
  end if;

  if exists(
    select 1
    from public.v515_assignments ra
    join public.v515_sessions rs on rs.id=ra.session_id
    where rs.class_name=v_class_name
      and ra.group_no=new.group_no
      and ra.manipulation_code=new.manipulation_code
      and rs.session_date < v_session_date
      and not exists(
        select 1 from public.v16_test_assignments ta2
        where ta2.real_assignment_id=ra.id
      )
  ) then
    raise exception using errcode='23514',message='REPEATED_GROUP_MANIPULATION';
  end if;
  return new;
end;
$$;

-- Replaces the first TEST clone with the approved calendar/manipulation projection.
create or replace function public.v16_clone_real_to_test(p_effective_date date)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_cycle_id uuid;
  v_reset jsonb;
  v_sessions integer:=0;
  v_assignments integer:=0;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not(select private.is_admin()) then return jsonb_build_object('ok',false,'code','FORBIDDEN','message','Accès Admin requis.'); end if;
  if p_effective_date is null then return jsonb_build_object('ok',false,'code','EFFECTIVE_DATE_REQUIRED','message','Date d’effet requise.'); end if;

  select id into v_cycle_id from public.v515_cycles where academic_year='2026/2027' and semester=1 limit 1;
  if v_cycle_id is null then return jsonb_build_object('ok',false,'code','CYCLE_NOT_FOUND','message','Planning RÉEL non initialisé.'); end if;

  v_reset:=public.v16_reset_test_context();
  if not coalesce((v_reset->>'ok')::boolean,false) then return v_reset; end if;

  insert into public.v16_test_sessions(real_session_id,session_date,start_time,end_time,class_name,lifecycle_status,created_by)
  select s.id,s.session_date,s.start_time,s.end_time,
    case s.session_date
      when date '2026-10-15' then null
      when date '2026-10-22' then 'MPI1-C'
      when date '2026-10-29' then 'MPI1-D'
      when date '2026-11-05' then null
      when date '2026-11-12' then 'MPI1-C'
      when date '2026-11-19' then 'MPI1-D'
      when date '2026-11-26' then 'MPI1-C'
      when date '2026-12-03' then 'MPI1-D'
      else s.class_name
    end,
    'draft',auth.uid()
  from public.v515_sessions s
  where s.cycle_id=v_cycle_id and s.session_date>=p_effective_date
  order by s.session_date;
  get diagnostics v_sessions=row_count;

  insert into public.v16_test_assignments(
    test_session_id,real_assignment_id,group_no,manipulation_code,teacher_id,room,created_by
  )
  select ts.id,a.id,a.group_no,
         private.v16_official_manipulation(rs.session_date,a.group_no),
         a.teacher_id,
         null::text as room,
         auth.uid()
  from public.v515_assignments a
  join public.v515_sessions rs on rs.id=a.session_id
  join public.v16_test_sessions ts on ts.real_session_id=rs.id
  where rs.cycle_id=v_cycle_id
    and rs.session_date>=p_effective_date
    and ts.class_name is not null
  order by rs.session_date,a.group_no;
  get diagnostics v_assignments=row_count;

  perform private.v515_audit(v_cycle_id,'v16_real_cloned_to_test',null,
    'Planning officiel projeté du RÉEL vers TEST.',
    jsonb_build_object('effective_date',p_effective_date,'sessions',v_sessions,'assignments',v_assignments,'rooms','A choisir'));

  return jsonb_build_object('ok',true,'effective_date',p_effective_date,'sessions',v_sessions,'assignments',v_assignments);
end;
$$;

revoke execute on function public.v16_clone_real_to_test(date) from public,anon;
grant execute on function public.v16_clone_real_to_test(date) to authenticated;

-- Safe structural TEST -> REAL apply. Calendar identity must be reconciled first.
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
    where ts.session_date>=p_effective_date
      and rs.class_name is distinct from ts.class_name
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
    select 1
    from public.v16_test_assignments ta
    join public.v16_test_sessions ts on ts.id=ta.test_session_id
    join public.v515_assignments ra on ra.id=ta.real_assignment_id
    join public.v515_sessions rs on rs.id=ts.real_session_id
    left join public.session_plans sp on sp.id=ra.legacy_plan_id
    where ts.session_date>=p_effective_date
      and (rs.lifecycle_status='completed'
        or v_local_now >= (rs.session_date::timestamp+rs.start_time)
        or (sp.session_id is not null and sp.deleted_at is null))
  ) then
    return jsonb_build_object('ok',false,'code','SESSION_ALREADY_STARTED','message','Une séance RÉEL a déjà commencé ou est terminée.','affected_sessions',0);
  end if;

  for v_week in
    select distinct date_trunc('week',s.session_date)::date week_start
    from public.v16_test_sessions s
    where s.class_name is not null and s.session_date>=p_effective_date
    order by 1
  loop
    v_check:=private.v16_verify_test_teacher_week(v_week.week_start);
    if not coalesce((v_check->>'ok')::boolean,false) then
      return jsonb_build_object('ok',false,'code','TEST_WEEK_VALIDATION_FAILED','message','Le scénario TEST contient une semaine invalide.','affected_sessions',0,'blockers',v_check->'blockers');
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

  perform private.v515_audit(v_cycle_id,'v16_test_structural_plan_applied',null,
    'Scénario TEST structurel appliqué au planning RÉEL.',
    jsonb_build_object('effective_date',p_effective_date,'affected_sessions',v_sessions,'changed_assignments',v_changed));

  return jsonb_build_object('ok',true,'affected_sessions',v_sessions,'changed_assignments',v_changed,'effective_date',p_effective_date,'blockers','[]'::jsonb,'warnings','[]'::jsonb);
end;
$$;

revoke execute on function public.v16_apply_test_teacher_plan(date) from public,anon;
grant execute on function public.v16_apply_test_teacher_plan(date) to authenticated;

commit;
