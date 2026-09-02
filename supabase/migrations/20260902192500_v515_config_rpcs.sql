-- V5.15 administrator configuration RPCs.

create or replace function public.v515_upsert_cycle(
  p_cycle_id uuid,
  p_academic_year_id uuid,
  p_name text,
  p_start_date date,
  p_end_date date,
  p_week_a_anchor_date date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_id uuid; before_state jsonb;
begin
  if auth.uid() is null or not public.current_user_is_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_start_date is null or p_end_date is null or p_start_date>p_end_date then raise exception 'INVALID_DATE_RANGE'; end if;
  if not exists(select 1 from public.academic_years where id=p_academic_year_id and archived_at is null) then raise exception 'ACADEMIC_YEAR_NOT_FOUND'; end if;
  if p_cycle_id is null then
    insert into public.v515_cycles(academic_year_id,name,start_date,end_date,week_a_anchor_date,updated_by)
    values(p_academic_year_id,trim(p_name),p_start_date,p_end_date,p_week_a_anchor_date,auth.uid()) returning id into v_id;
  else
    select to_jsonb(c) into before_state from public.v515_cycles c where c.id=p_cycle_id and c.status='DRAFT' for update;
    if before_state is null then raise exception 'CYCLE_NOT_DRAFT'; end if;
    update public.v515_cycles set academic_year_id=p_academic_year_id,name=trim(p_name),start_date=p_start_date,end_date=p_end_date,
      week_a_anchor_date=p_week_a_anchor_date,updated_at=now(),updated_by=auth.uid() where id=p_cycle_id;
    v_id:=p_cycle_id;
  end if;
  insert into public.v515_audit_log(actor_id,action,entity_type,entity_id,before_state,after_state)
  select auth.uid(),'UPSERT_CYCLE','v515_cycle',v_id,before_state,to_jsonb(c) from public.v515_cycles c where c.id=v_id;
  return jsonb_build_object('ok',true,'cycle_id',v_id);
end;
$$;

create or replace function public.v515_upsert_class_config(
  p_class_config_id uuid,
  p_cycle_id uuid,
  p_class_key text,
  p_track text,
  p_class_number integer,
  p_display_name text,
  p_group_count integer,
  p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_id uuid; before_state jsonb;
begin
  if auth.uid() is null or not public.current_user_is_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_group_count not between 1 and 6 then raise exception 'INVALID_GROUP_COUNT'; end if;
  perform 1 from public.v515_cycles where id=p_cycle_id and status='DRAFT' for update;
  if not found then raise exception 'CYCLE_NOT_DRAFT'; end if;
  if p_track is not null and p_track not in ('MPI','PC') then raise exception 'INVALID_TRACK'; end if;
  if p_class_config_id is null then
    insert into public.v515_class_config(cycle_id,class_key,track,class_number,display_name,group_count,active,updated_by)
    values(p_cycle_id,trim(p_class_key),p_track,p_class_number,trim(p_display_name),p_group_count,coalesce(p_active,true),auth.uid())
    on conflict(cycle_id,class_key) do update set track=excluded.track,class_number=excluded.class_number,display_name=excluded.display_name,
      group_count=excluded.group_count,active=excluded.active,updated_at=now(),updated_by=auth.uid()
    returning id into v_id;
  else
    select to_jsonb(cc) into before_state from public.v515_class_config cc where cc.id=p_class_config_id and cc.cycle_id=p_cycle_id for update;
    if before_state is null then raise exception 'CLASS_CONFIG_NOT_FOUND'; end if;
    update public.v515_class_config set class_key=trim(p_class_key),track=p_track,class_number=p_class_number,display_name=trim(p_display_name),
      group_count=p_group_count,active=coalesce(p_active,true),updated_at=now(),updated_by=auth.uid() where id=p_class_config_id;
    v_id:=p_class_config_id;
    delete from public.v515_group_rosters where class_config_id=v_id and group_no>p_group_count;
  end if;
  insert into public.v515_audit_log(actor_id,action,entity_type,entity_id,before_state,after_state)
  select auth.uid(),'UPSERT_CLASS_CONFIG','v515_class_config',v_id,before_state,to_jsonb(cc) from public.v515_class_config cc where cc.id=v_id;
  return jsonb_build_object('ok',true,'class_config_id',v_id,'group_count',p_group_count);
end;
$$;

create or replace function public.v515_set_group_roster(
  p_class_config_id uuid,
  p_group_no integer,
  p_legacy_class_id uuid,
  p_student_group_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_cc public.v515_class_config%rowtype; legacy public.classes%rowtype; v_id uuid;
begin
  if auth.uid() is null or not public.current_user_is_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  select cfg.* into v_cc from public.v515_class_config cfg join public.v515_cycles cyc on cyc.id=cfg.cycle_id where cfg.id=p_class_config_id and cyc.status='DRAFT' for update of cfg;
  if not found then raise exception 'CYCLE_NOT_DRAFT'; end if;
  if p_group_no not between 1 and v_cc.group_count then raise exception 'INVALID_GROUP_NUMBER'; end if;
  select * into legacy from public.classes where id=p_legacy_class_id and deleted_at is null;
  if not found then raise exception 'LEGACY_CLASS_NOT_FOUND'; end if;
  if legacy.group_number is distinct from p_group_no then raise exception 'ROSTER_GROUP_MISMATCH'; end if;
  if v_cc.track is not null and legacy.track is distinct from v_cc.track then raise exception 'ROSTER_CLASS_MISMATCH'; end if;
  if v_cc.class_number is not null and legacy.class_number is distinct from v_cc.class_number then raise exception 'ROSTER_CLASS_MISMATCH'; end if;
  insert into public.v515_group_rosters(class_config_id,group_no,legacy_class_id,student_group_id,updated_by)
  values(p_class_config_id,p_group_no,p_legacy_class_id,p_student_group_id,auth.uid())
  on conflict(class_config_id,group_no) do update set legacy_class_id=excluded.legacy_class_id,student_group_id=excluded.student_group_id,
    updated_at=now(),updated_by=auth.uid() returning id into v_id;
  insert into public.v515_audit_log(actor_id,action,entity_type,entity_id,after_state)
  values(auth.uid(),'SET_GROUP_ROSTER','v515_group_roster',v_id,jsonb_build_object('class_config_id',p_class_config_id,'group_no',p_group_no,'legacy_class_id',p_legacy_class_id,'student_group_id',p_student_group_id));
  return jsonb_build_object('ok',true,'roster_id',v_id);
end;
$$;

create or replace function public.v515_create_roster_group(p_class_config_id uuid,p_group_no integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_cc public.v515_class_config%rowtype; v_cycle public.v515_cycles%rowtype; legacy_id uuid; sg_id uuid; roster_id uuid; legacy_name text;
begin
  if auth.uid() is null or not public.current_user_is_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  select cfg.* into v_cc from public.v515_class_config cfg where cfg.id=p_class_config_id for update;
  if not found then raise exception 'CLASS_CONFIG_NOT_FOUND'; end if;
  select * into v_cycle from public.v515_cycles where id=v_cc.cycle_id and status='DRAFT' for update;
  if not found then raise exception 'CYCLE_NOT_DRAFT'; end if;
  if p_group_no not between 1 and v_cc.group_count then raise exception 'INVALID_GROUP_NUMBER'; end if;
  if exists(select 1 from public.v515_group_rosters where class_config_id=v_cc.id and group_no=p_group_no) then raise exception 'ROSTER_ALREADY_MAPPED'; end if;
  legacy_name:=v_cc.display_name||'-G'||p_group_no::text;
  select id into legacy_id from public.classes
    where deleted_at is null and track is not distinct from v_cc.track and class_number is not distinct from v_cc.class_number and group_number=p_group_no
    order by created_at limit 1;
  if legacy_id is null then
    insert into public.classes(teacher_id,name,module,track,class_number,group_number,updated_by)
    values(auth.uid(),legacy_name,'TP Physique',v_cc.track,v_cc.class_number,p_group_no,auth.uid()) returning id into legacy_id;
  end if;
  select id into sg_id from public.student_groups
    where deleted_at is null and academic_year_id=v_cycle.academic_year_id and track is not distinct from v_cc.track
      and class_number is not distinct from v_cc.class_number and group_number=p_group_no
    order by created_at limit 1;
  if sg_id is null then
    insert into public.student_groups(academic_year_id,track,class_number,group_number,display_name,updated_by)
    values(v_cycle.academic_year_id,v_cc.track,v_cc.class_number,p_group_no,legacy_name,auth.uid()) returning id into sg_id;
  end if;
  insert into public.v515_group_rosters(class_config_id,group_no,legacy_class_id,student_group_id,updated_by)
  values(v_cc.id,p_group_no,legacy_id,sg_id,auth.uid()) returning id into roster_id;
  insert into public.v515_audit_log(actor_id,action,entity_type,entity_id,after_state)
  values(auth.uid(),'CREATE_ROSTER_GROUP','v515_group_roster',roster_id,jsonb_build_object('group_no',p_group_no,'legacy_class_id',legacy_id,'student_group_id',sg_id));
  return jsonb_build_object('ok',true,'roster_id',roster_id,'legacy_class_id',legacy_id,'student_group_id',sg_id,'name',legacy_name);
end;
$$;

create or replace function public.v515_upsert_timeslot(
  p_timeslot_id uuid,
  p_day_of_week smallint,
  p_start time,
  p_end time,
  p_room text,
  p_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_id uuid; before_state jsonb;
begin
  if auth.uid() is null or not public.current_user_is_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_day_of_week not between 1 and 7 or p_start>=p_end then raise exception 'INVALID_TIMESLOT'; end if;
  if p_timeslot_id is not null and exists(
    select 1 from public.v515_fortnight_pairs fp join public.v515_cycles c on c.id=fp.cycle_id
    where fp.timeslot_id=p_timeslot_id and c.status<>'DRAFT'
  ) then raise exception 'TIMESLOT_LOCKED'; end if;
  if p_timeslot_id is null then
    insert into public.v515_timeslots(day_of_week,start_time,end_time,room,active,updated_by)
    values(p_day_of_week,p_start,p_end,nullif(trim(p_room),''),coalesce(p_active,true),auth.uid()) returning id into v_id;
  else
    select to_jsonb(ts) into before_state from public.v515_timeslots ts where ts.id=p_timeslot_id for update;
    if before_state is null then raise exception 'TIMESLOT_NOT_FOUND'; end if;
    update public.v515_timeslots set day_of_week=p_day_of_week,start_time=p_start,end_time=p_end,room=nullif(trim(p_room),''),
      active=coalesce(p_active,true),updated_at=now(),updated_by=auth.uid() where id=p_timeslot_id;
    v_id:=p_timeslot_id;
  end if;
  insert into public.v515_audit_log(actor_id,action,entity_type,entity_id,before_state,after_state)
  select auth.uid(),'UPSERT_TIMESLOT','v515_timeslot',v_id,before_state,to_jsonb(ts) from public.v515_timeslots ts where ts.id=v_id;
  return jsonb_build_object('ok',true,'timeslot_id',v_id);
end;
$$;

create or replace function public.v515_set_fortnight_pair(
  p_cycle_id uuid,
  p_timeslot_id uuid,
  p_week_a_class_config_id uuid,
  p_week_b_class_config_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_id uuid;
begin
  if auth.uid() is null or not public.current_user_is_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  perform 1 from public.v515_cycles where id=p_cycle_id and status='DRAFT' for update;
  if not found then raise exception 'CYCLE_NOT_DRAFT'; end if;
  if p_week_a_class_config_id=p_week_b_class_config_id then raise exception 'PAIR_CLASSES_MUST_DIFFER'; end if;
  if not exists(select 1 from public.v515_timeslots where id=p_timeslot_id and active) then raise exception 'TIMESLOT_NOT_FOUND'; end if;
  if (select count(*) from public.v515_class_config where cycle_id=p_cycle_id and id in (p_week_a_class_config_id,p_week_b_class_config_id) and active)<>2 then
    raise exception 'PAIR_CLASS_NOT_FOUND';
  end if;
  insert into public.v515_fortnight_pairs(cycle_id,timeslot_id,week_a_class_config_id,week_b_class_config_id,updated_by)
  values(p_cycle_id,p_timeslot_id,p_week_a_class_config_id,p_week_b_class_config_id,auth.uid())
  on conflict(cycle_id,timeslot_id) do update set week_a_class_config_id=excluded.week_a_class_config_id,
    week_b_class_config_id=excluded.week_b_class_config_id,updated_at=now(),updated_by=auth.uid()
  returning id into v_id;
  insert into public.v515_audit_log(actor_id,action,entity_type,entity_id,after_state)
  values(auth.uid(),'SET_FORTNIGHT_PAIR','v515_fortnight_pair',v_id,jsonb_build_object('cycle_id',p_cycle_id,'timeslot_id',p_timeslot_id,'week_a',p_week_a_class_config_id,'week_b',p_week_b_class_config_id));
  return jsonb_build_object('ok',true,'pair_id',v_id);
end;
$$;

revoke all on function public.v515_upsert_cycle(uuid,uuid,text,date,date,date) from public, anon;
revoke all on function public.v515_upsert_class_config(uuid,uuid,text,text,integer,text,integer,boolean) from public, anon;
revoke all on function public.v515_set_group_roster(uuid,integer,uuid,uuid) from public, anon;
revoke all on function public.v515_create_roster_group(uuid,integer) from public, anon;
revoke all on function public.v515_upsert_timeslot(uuid,smallint,time,time,text,boolean) from public, anon;
revoke all on function public.v515_set_fortnight_pair(uuid,uuid,uuid,uuid) from public, anon;
grant execute on function public.v515_upsert_cycle(uuid,uuid,text,date,date,date) to authenticated;
grant execute on function public.v515_upsert_class_config(uuid,uuid,text,text,integer,text,integer,boolean) to authenticated;
grant execute on function public.v515_set_group_roster(uuid,integer,uuid,uuid) to authenticated;
grant execute on function public.v515_create_roster_group(uuid,integer) to authenticated;
grant execute on function public.v515_upsert_timeslot(uuid,smallint,time,time,text,boolean) to authenticated;
grant execute on function public.v515_set_fortnight_pair(uuid,uuid,uuid,uuid) to authenticated;
