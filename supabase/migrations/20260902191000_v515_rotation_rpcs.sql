-- V5.15 deterministic fortnight rotation and lifecycle RPCs.

create unique index if not exists v515_generated_position_uidx
  on public.v515_session_positions(cycle_id, class_config_id, pedagogical_session_no, group_no)
  where source_position_id is null and status <> 'CANCELLED';

create or replace function public.v515_generate_cycle(p_cycle_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  c public.v515_cycles%rowtype;
  missing_rosters integer;
  bad_pairing integer;
  incomplete_classes integer;
  rotation_count integer;
  position_count integer;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED' using errcode='42501';
  end if;
  if not public.current_user_is_admin() then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;

  select * into c from public.v515_cycles where id=p_cycle_id for update;
  if not found then raise exception 'CYCLE_NOT_FOUND'; end if;
  if c.status <> 'DRAFT' then raise exception 'CYCLE_NOT_DRAFT'; end if;

  select count(*) into missing_rosters
  from public.v515_class_config cc
  where cc.cycle_id=p_cycle_id and cc.active
    and (
      select count(*)
      from public.v515_group_rosters gr
      where gr.class_config_id=cc.id
        and gr.group_no between 1 and cc.group_count
    ) <> cc.group_count;
  if missing_rosters > 0 then raise exception 'ROSTER_MAPPING_INCOMPLETE'; end if;

  select count(*) into bad_pairing
  from (
    select class_config_id, count(*) n
    from (
      select week_a_class_config_id class_config_id from public.v515_fortnight_pairs where cycle_id=p_cycle_id
      union all
      select week_b_class_config_id class_config_id from public.v515_fortnight_pairs where cycle_id=p_cycle_id
    ) x
    group by class_config_id having count(*) <> 1
  ) d;
  if bad_pairing > 0 then raise exception 'CLASS_PAIRING_NOT_UNIQUE'; end if;

  if exists (
    select 1 from public.v515_class_config cc
    where cc.cycle_id=p_cycle_id and cc.active
      and not exists (
        select 1 from public.v515_fortnight_pairs fp
        where fp.cycle_id=p_cycle_id
          and (fp.week_a_class_config_id=cc.id or fp.week_b_class_config_id=cc.id)
      )
  ) then
    raise exception 'CLASS_PAIRING_MISSING';
  end if;

  delete from public.v515_requests r
  using public.v515_session_positions p
  where r.position_id=p.id and p.cycle_id=p_cycle_id;
  delete from public.v515_assignments a
  using public.v515_session_positions p
  where a.position_id=p.id and p.cycle_id=p_cycle_id;
  delete from public.v515_session_positions where cycle_id=p_cycle_id;
  delete from public.v515_rotation where cycle_id=p_cycle_id;

  with raw_occurrences as (
    select
      fp.cycle_id,
      ts.id as timeslot_id,
      gs::date as session_date,
      ts.start_time,
      ts.end_time,
      ts.room,
      case when mod(((gs::date - c.week_a_anchor_date) / 7), 2)=0 then 'A' else 'B' end as fortnight_week,
      case when mod(((gs::date - c.week_a_anchor_date) / 7), 2)=0
        then fp.week_a_class_config_id else fp.week_b_class_config_id end as class_config_id
    from public.v515_fortnight_pairs fp
    join public.v515_timeslots ts on ts.id=fp.timeslot_id and ts.active
    cross join lateral generate_series(c.start_date::timestamp, c.end_date::timestamp, interval '1 day') gs
    where fp.cycle_id=p_cycle_id
      and extract(isodow from gs)::integer=ts.day_of_week
  ), ranked as (
    select r.*,
      row_number() over(partition by r.class_config_id order by r.session_date,r.start_time,r.timeslot_id) as pedagogical_session_no
    from raw_occurrences r
  ), o as (
    select * from ranked where pedagogical_session_no between 1 and 6
  )
  insert into public.v515_rotation(cycle_id,class_config_id,pedagogical_session_no,group_no,manipulation_code)
  select
    p_cycle_id,
    o.class_config_id,
    o.pedagogical_session_no,
    g.group_no,
    'M' || (mod(g.group_no + o.pedagogical_session_no - 2, 6) + 1)::text
  from o
  join public.v515_class_config cc on cc.id=o.class_config_id and cc.active
  cross join lateral generate_series(1,cc.group_count) as g(group_no);
  get diagnostics rotation_count = row_count;

  with raw_occurrences as (
    select
      fp.cycle_id,
      ts.id as timeslot_id,
      gs::date as session_date,
      ts.start_time,
      ts.end_time,
      ts.room,
      case when mod(((gs::date - c.week_a_anchor_date) / 7), 2)=0 then 'A' else 'B' end as fortnight_week,
      case when mod(((gs::date - c.week_a_anchor_date) / 7), 2)=0
        then fp.week_a_class_config_id else fp.week_b_class_config_id end as class_config_id
    from public.v515_fortnight_pairs fp
    join public.v515_timeslots ts on ts.id=fp.timeslot_id and ts.active
    cross join lateral generate_series(c.start_date::timestamp, c.end_date::timestamp, interval '1 day') gs
    where fp.cycle_id=p_cycle_id
      and extract(isodow from gs)::integer=ts.day_of_week
  ), ranked as (
    select r.*,
      row_number() over(partition by r.class_config_id order by r.session_date,r.start_time,r.timeslot_id) as pedagogical_session_no
    from raw_occurrences r
  ), o as (
    select * from ranked where pedagogical_session_no between 1 and 6
  )
  insert into public.v515_session_positions(
    cycle_id,class_config_id,roster_id,group_no,pedagogical_session_no,manipulation_code,
    session_date,start_time,end_time,room,fortnight_week,status,updated_by
  )
  select
    p_cycle_id,o.class_config_id,gr.id,rot.group_no,o.pedagogical_session_no,rot.manipulation_code,
    o.session_date,o.start_time,o.end_time,o.room,o.fortnight_week,'DRAFT',auth.uid()
  from o
  join public.v515_rotation rot
    on rot.cycle_id=p_cycle_id and rot.class_config_id=o.class_config_id
   and rot.pedagogical_session_no=o.pedagogical_session_no
  join public.v515_group_rosters gr
    on gr.class_config_id=o.class_config_id and gr.group_no=rot.group_no;
  get diagnostics position_count = row_count;

  select count(*) into incomplete_classes
  from public.v515_class_config cc
  where cc.cycle_id=p_cycle_id and cc.active
    and (
      select count(distinct p.pedagogical_session_no)
      from public.v515_session_positions p
      where p.cycle_id=p_cycle_id and p.class_config_id=cc.id and p.status<>'CANCELLED'
    ) <> 6;
  if incomplete_classes > 0 then
    raise exception 'INSUFFICIENT_FORTNIGHT_OCCURRENCES';
  end if;

  insert into public.v515_audit_log(actor_id,action,entity_type,entity_id,after_state,metadata)
  values(auth.uid(),'GENERATE_CYCLE','v515_cycle',p_cycle_id,
         jsonb_build_object('status','DRAFT'),
         jsonb_build_object('rotation_rows',rotation_count,'position_rows',position_count));

  return jsonb_build_object('ok',true,'cycle_id',p_cycle_id,'rotation_rows',rotation_count,'position_rows',position_count,'status','DRAFT');
end;
$$;

create or replace function public.v515_open_cycle(p_cycle_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare n integer;
begin
  if auth.uid() is null or not public.current_user_is_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  perform 1 from public.v515_cycles where id=p_cycle_id and status='DRAFT' for update;
  if not found then raise exception 'CYCLE_NOT_DRAFT'; end if;
  select count(*) into n from public.v515_session_positions where cycle_id=p_cycle_id and status='DRAFT';
  if n=0 then raise exception 'CYCLE_NOT_GENERATED'; end if;
  update public.v515_session_positions set status='OPEN',updated_at=now(),updated_by=auth.uid() where cycle_id=p_cycle_id and status='DRAFT';
  update public.v515_cycles set status='OPEN_FOR_REQUESTS',updated_at=now(),updated_by=auth.uid() where id=p_cycle_id;
  insert into public.v515_audit_log(actor_id,action,entity_type,entity_id,after_state)
  values(auth.uid(),'OPEN_CYCLE','v515_cycle',p_cycle_id,jsonb_build_object('status','OPEN_FOR_REQUESTS'));
  return jsonb_build_object('ok',true,'status','OPEN_FOR_REQUESTS','positions',n);
end;
$$;

create or replace function public.v515_reset_cycle(p_cycle_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare req_count integer; ass_count integer; pos_count integer;
begin
  if auth.uid() is null or not public.current_user_is_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  perform 1 from public.v515_cycles where id=p_cycle_id and status in ('OPEN_FOR_REQUESTS','ASSIGNMENT') for update;
  if not found then raise exception 'CYCLE_RESET_NOT_ALLOWED'; end if;
  if exists(select 1 from public.v515_session_positions where cycle_id=p_cycle_id and status in ('FINALIZED','REALIZED')) then
    raise exception 'CYCLE_RESET_NOT_ALLOWED_FINALIZED';
  end if;
  select count(*) into req_count from public.v515_requests r join public.v515_session_positions p on p.id=r.position_id where p.cycle_id=p_cycle_id;
  select count(*) into ass_count from public.v515_assignments a join public.v515_session_positions p on p.id=a.position_id where p.cycle_id=p_cycle_id;
  select count(*) into pos_count from public.v515_session_positions where cycle_id=p_cycle_id;
  delete from public.v515_requests r using public.v515_session_positions p where r.position_id=p.id and p.cycle_id=p_cycle_id;
  delete from public.v515_assignments a using public.v515_session_positions p where a.position_id=p.id and p.cycle_id=p_cycle_id;
  delete from public.v515_session_positions where cycle_id=p_cycle_id;
  delete from public.v515_rotation where cycle_id=p_cycle_id;
  update public.v515_cycles set status='DRAFT',updated_at=now(),updated_by=auth.uid() where id=p_cycle_id;
  insert into public.v515_audit_log(actor_id,action,entity_type,entity_id,before_state,after_state,metadata)
  values(auth.uid(),'RESET_CYCLE','v515_cycle',p_cycle_id,
    jsonb_build_object('status','OPEN_OR_ASSIGNMENT'),jsonb_build_object('status','DRAFT'),
    jsonb_build_object('requests_removed',req_count,'assignments_removed',ass_count,'positions_removed',pos_count));
  return jsonb_build_object('ok',true,'status','DRAFT','requests_removed',req_count,'assignments_removed',ass_count,'positions_removed',pos_count);
end;
$$;

create or replace function public.v515_cancel_position(p_position_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare p public.v515_session_positions%rowtype;
begin
  if auth.uid() is null or not public.current_user_is_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  select * into p from public.v515_session_positions where id=p_position_id for update;
  if not found then raise exception 'POSITION_NOT_FOUND'; end if;
  if p.status in ('FINALIZED','REALIZED') then raise exception 'POSITION_IMMUTABLE'; end if;
  delete from public.v515_assignments where position_id=p_position_id;
  update public.v515_requests set status='CANCELLED',updated_at=now(),decided_at=now(),decided_by=auth.uid()
    where position_id=p_position_id and status in ('PENDING','ACCEPTED');
  update public.v515_session_positions set status='CANCELLED',updated_at=now(),updated_by=auth.uid() where id=p_position_id;
  insert into public.v515_audit_log(actor_id,action,entity_type,entity_id,before_state,after_state)
  values(auth.uid(),'CANCEL_POSITION','v515_position',p_position_id,to_jsonb(p),jsonb_build_object('status','CANCELLED'));
  return jsonb_build_object('ok',true,'position_id',p_position_id,'status','CANCELLED');
end;
$$;

create or replace function public.v515_create_catchup(
  p_position_id uuid,
  p_date date,
  p_start time,
  p_end time,
  p_room text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare src public.v515_session_positions%rowtype; cycle_status text; new_id uuid; new_status text;
begin
  if auth.uid() is null or not public.current_user_is_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_start>=p_end then raise exception 'INVALID_TIME_RANGE'; end if;
  select * into src from public.v515_session_positions where id=p_position_id for update;
  if not found then raise exception 'POSITION_NOT_FOUND'; end if;
  if src.status<>'CANCELLED' then raise exception 'SOURCE_NOT_CANCELLED'; end if;
  select status into cycle_status from public.v515_cycles where id=src.cycle_id;
  if cycle_status='FINALIZED' then raise exception 'CYCLE_IMMUTABLE'; end if;
  new_status := case when cycle_status='DRAFT' then 'DRAFT' else 'OPEN' end;
  insert into public.v515_session_positions(
    cycle_id,class_config_id,roster_id,group_no,pedagogical_session_no,manipulation_code,
    session_date,start_time,end_time,room,fortnight_week,status,source_position_id,updated_by
  ) values(
    src.cycle_id,src.class_config_id,src.roster_id,src.group_no,src.pedagogical_session_no,src.manipulation_code,
    p_date,p_start,p_end,p_room,'EXCEPTION',new_status,p_position_id,auth.uid()
  ) returning id into new_id;
  insert into public.v515_audit_log(actor_id,action,entity_type,entity_id,after_state,metadata)
  values(auth.uid(),'CREATE_CATCHUP','v515_position',new_id,
    jsonb_build_object('status',new_status,'date',p_date,'start',p_start,'end',p_end,'room',p_room),
    jsonb_build_object('source_position_id',p_position_id));
  return jsonb_build_object('ok',true,'position_id',new_id,'source_position_id',p_position_id,'status',new_status);
end;
$$;

create or replace function public.v515_set_rotation_exception(p_position_id uuid,p_manipulation_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare p public.v515_session_positions%rowtype; old_code text;
begin
  if auth.uid() is null or not public.current_user_is_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if p_manipulation_code not in ('M1','M2','M3','M4','M5','M6') then raise exception 'INVALID_MANIPULATION'; end if;
  select * into p from public.v515_session_positions where id=p_position_id for update;
  if not found then raise exception 'POSITION_NOT_FOUND'; end if;
  if p.status in ('FINALIZED','REALIZED','CANCELLED') then raise exception 'POSITION_IMMUTABLE'; end if;
  if exists(select 1 from public.v515_assignments where position_id=p_position_id) then raise exception 'POSITION_ALREADY_ASSIGNED'; end if;
  if exists(
    select 1 from public.v515_session_positions q
    where q.id<>p.id and q.cycle_id=p.cycle_id and q.class_config_id=p.class_config_id
      and q.session_date=p.session_date and q.start_time=p.start_time and q.end_time=p.end_time
      and q.status<>'CANCELLED' and q.manipulation_code=p_manipulation_code
  ) then raise exception 'DUPLICATE_SIMULTANEOUS_MANIPULATION'; end if;
  if exists(
    select 1 from public.v515_session_positions q
    where q.id<>p.id and q.cycle_id=p.cycle_id and q.class_config_id=p.class_config_id
      and q.group_no=p.group_no and q.status<>'CANCELLED' and q.manipulation_code=p_manipulation_code
  ) then raise exception 'GROUP_MANIPULATION_REPEATED'; end if;
  if (
    select count(distinct manipulation_code)
    from (
      select q.manipulation_code from public.v515_session_positions q
      where q.id<>p.id and q.cycle_id=p.cycle_id and q.class_config_id=p.class_config_id
        and q.group_no=p.group_no and q.status<>'CANCELLED'
      union all select p_manipulation_code
    ) s
  ) <> 6 then raise exception 'ROTATION_WOULD_BE_INCOMPLETE'; end if;
  old_code:=p.manipulation_code;
  update public.v515_session_positions set manipulation_code=p_manipulation_code,updated_at=now(),updated_by=auth.uid() where id=p.id;
  update public.v515_rotation set manipulation_code=p_manipulation_code
    where cycle_id=p.cycle_id and class_config_id=p.class_config_id
      and pedagogical_session_no=p.pedagogical_session_no and group_no=p.group_no;
  insert into public.v515_audit_log(actor_id,action,entity_type,entity_id,before_state,after_state)
  values(auth.uid(),'ROTATION_EXCEPTION','v515_position',p.id,
    jsonb_build_object('manipulation_code',old_code),jsonb_build_object('manipulation_code',p_manipulation_code));
  return jsonb_build_object('ok',true,'position_id',p.id,'old_manipulation',old_code,'manipulation_code',p_manipulation_code);
end;
$$;

revoke all on function public.v515_generate_cycle(uuid) from public, anon;
revoke all on function public.v515_open_cycle(uuid) from public, anon;
revoke all on function public.v515_reset_cycle(uuid) from public, anon;
revoke all on function public.v515_cancel_position(uuid) from public, anon;
revoke all on function public.v515_create_catchup(uuid,date,time,time,text) from public, anon;
revoke all on function public.v515_set_rotation_exception(uuid,text) from public, anon;
grant execute on function public.v515_generate_cycle(uuid) to authenticated;
grant execute on function public.v515_open_cycle(uuid) to authenticated;
grant execute on function public.v515_reset_cycle(uuid) to authenticated;
grant execute on function public.v515_cancel_position(uuid) to authenticated;
grant execute on function public.v515_create_catchup(uuid,date,time,time,text) to authenticated;
grant execute on function public.v515_set_rotation_exception(uuid,text) to authenticated;
