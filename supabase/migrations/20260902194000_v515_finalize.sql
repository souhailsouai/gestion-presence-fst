-- V5.15 verification, finalization, and realization bridge.

create or replace function public.v515_verify_cycle(p_cycle_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare errors jsonb := '[]'::jsonb; part jsonb; total_count integer; assigned_count integer;
begin
  if auth.uid() is null or not public.current_user_is_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  if not exists(select 1 from public.v515_cycles where id=p_cycle_id) then raise exception 'CYCLE_NOT_FOUND'; end if;

  select coalesce(jsonb_agg(jsonb_build_object('code','UNCOVERED_POSITION','position_id',p.id,'class_config_id',p.class_config_id,'group_no',p.group_no,'date',p.session_date,'manipulation',p.manipulation_code)),'[]'::jsonb)
  into part
  from public.v515_session_positions p
  where p.cycle_id=p_cycle_id and p.status<>'CANCELLED'
    and not exists(select 1 from public.v515_assignments a where a.position_id=p.id);
  errors := errors || part;

  select coalesce(jsonb_agg(jsonb_build_object('code','INCOMPLETE_ROTATION','class_config_id',x.class_config_id,'group_no',x.group_no,'position_count',x.position_count,'distinct_manipulations',x.distinct_manipulations)),'[]'::jsonb)
  into part
  from (
    select p.class_config_id,p.group_no,count(*) position_count,count(distinct p.manipulation_code) distinct_manipulations
    from public.v515_session_positions p
    where p.cycle_id=p_cycle_id and p.status<>'CANCELLED'
    group by p.class_config_id,p.group_no
    having count(*)<>6 or count(distinct p.manipulation_code)<>6
  ) x;
  errors := errors || part;

  select coalesce(jsonb_agg(jsonb_build_object('code','DUPLICATE_MANIPULATION','class_config_id',x.class_config_id,'date',x.session_date,'start_time',x.start_time,'manipulation',x.manipulation_code)),'[]'::jsonb)
  into part
  from (
    select p.class_config_id,p.session_date,p.start_time,p.end_time,p.manipulation_code,count(*) n
    from public.v515_session_positions p
    where p.cycle_id=p_cycle_id and p.status<>'CANCELLED'
    group by p.class_config_id,p.session_date,p.start_time,p.end_time,p.manipulation_code
    having count(*)>1
  ) x;
  errors := errors || part;

  select coalesce(jsonb_agg(jsonb_build_object('code','QUOTA_EXCEEDED','teacher_id',x.teacher_id,'assigned',x.n,'quota',x.quota)),'[]'::jsonb)
  into part
  from (
    select a.teacher_id,count(*) n,tc.quota
    from public.v515_assignments a
    join public.v515_session_positions p on p.id=a.position_id and p.cycle_id=p_cycle_id and p.status<>'CANCELLED'
    join public.v515_teacher_config tc on tc.teacher_id=a.teacher_id
    group by a.teacher_id,tc.quota having count(*)>tc.quota
  ) x;
  errors := errors || part;

  select coalesce(jsonb_agg(jsonb_build_object('code','MANIPULATION_NOT_ALLOWED','position_id',p.id,'teacher_id',a.teacher_id,'manipulation',p.manipulation_code)),'[]'::jsonb)
  into part
  from public.v515_assignments a
  join public.v515_session_positions p on p.id=a.position_id
  where p.cycle_id=p_cycle_id and p.status<>'CANCELLED'
    and not exists(select 1 from public.v515_teacher_manipulations tm where tm.teacher_id=a.teacher_id and tm.manipulation_code=p.manipulation_code);
  errors := errors || part;

  select coalesce(jsonb_agg(jsonb_build_object('code','TEACHER_OVERLAP','teacher_id',x.teacher_id,'position_id_1',x.p1,'position_id_2',x.p2,'date',x.session_date)),'[]'::jsonb)
  into part
  from (
    select a1.teacher_id,p1.id p1,p2.id p2,p1.session_date
    from public.v515_assignments a1
    join public.v515_session_positions p1 on p1.id=a1.position_id and p1.cycle_id=p_cycle_id and p1.status<>'CANCELLED'
    join public.v515_assignments a2 on a2.teacher_id=a1.teacher_id and a2.id>a1.id
    join public.v515_session_positions p2 on p2.id=a2.position_id and p2.cycle_id=p_cycle_id and p2.status<>'CANCELLED'
    where p1.session_date=p2.session_date and p1.start_time<p2.end_time and p1.end_time>p2.start_time
  ) x;
  errors := errors || part;

  select coalesce(jsonb_agg(jsonb_build_object('code','ROSTER_MAPPING_MISSING','position_id',p.id,'class_config_id',p.class_config_id,'group_no',p.group_no)),'[]'::jsonb)
  into part
  from public.v515_session_positions p
  left join public.v515_group_rosters gr on gr.id=p.roster_id
  where p.cycle_id=p_cycle_id and p.status<>'CANCELLED' and gr.id is null;
  errors := errors || part;

  select count(*) into total_count from public.v515_session_positions where cycle_id=p_cycle_id and status<>'CANCELLED';
  select count(*) into assigned_count from public.v515_assignments a join public.v515_session_positions p on p.id=a.position_id where p.cycle_id=p_cycle_id and p.status<>'CANCELLED';

  return jsonb_build_object(
    'ok',jsonb_array_length(errors)=0,
    'errors',errors,
    'counts',jsonb_build_object('positions',total_count,'assigned',assigned_count,'uncovered',greatest(total_count-assigned_count,0))
  );
end;
$$;

create or replace function public.v515_finalize_cycle(p_cycle_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare c public.v515_cycles%rowtype; verification jsonb; inserted_count integer;
begin
  if auth.uid() is null or not public.current_user_is_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  select * into c from public.v515_cycles where id=p_cycle_id for update;
  if not found then raise exception 'CYCLE_NOT_FOUND'; end if;
  if c.status='FINALIZED' then
    return jsonb_build_object('ok',true,'cycle_id',p_cycle_id,'status','FINALIZED','already_finalized',true);
  end if;
  if c.status not in ('OPEN_FOR_REQUESTS','ASSIGNMENT') then raise exception 'CYCLE_NOT_FINALIZABLE'; end if;

  verification:=public.v515_verify_cycle(p_cycle_id);
  if not coalesce((verification->>'ok')::boolean,false) then return verification || jsonb_build_object('code','VERIFICATION_FAILED'); end if;

  insert into public.sessions(
    teacher_id,class_id,session_date,start_time,end_time,updated_by,
    v515_position_id,manipulation_code,room
  )
  select a.teacher_id,gr.legacy_class_id,p.session_date,p.start_time,p.end_time,auth.uid(),p.id,p.manipulation_code,p.room
  from public.v515_session_positions p
  join public.v515_assignments a on a.position_id=p.id
  join public.v515_group_rosters gr on gr.id=p.roster_id
  where p.cycle_id=p_cycle_id and p.status<>'CANCELLED'
    and not exists(select 1 from public.sessions s where s.v515_position_id=p.id);
  get diagnostics inserted_count=row_count;

  update public.v515_session_positions
  set status='FINALIZED',updated_at=now(),updated_by=auth.uid()
  where cycle_id=p_cycle_id and status<>'CANCELLED';
  update public.v515_cycles set status='FINALIZED',updated_at=now(),updated_by=auth.uid() where id=p_cycle_id;

  insert into public.v515_audit_log(actor_id,action,entity_type,entity_id,after_state,metadata)
  values(auth.uid(),'FINALIZE_CYCLE','v515_cycle',p_cycle_id,jsonb_build_object('status','FINALIZED'),jsonb_build_object('sessions_inserted',inserted_count,'verification',verification));

  return jsonb_build_object('ok',true,'cycle_id',p_cycle_id,'status','FINALIZED','sessions_inserted',inserted_count,'verification',verification);
end;
$$;

create or replace function public.v515_mark_realized(p_position_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare p public.v515_session_positions%rowtype; s public.sessions%rowtype;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode='42501'; end if;
  select * into p from public.v515_session_positions where id=p_position_id for update;
  if not found then raise exception 'POSITION_NOT_FOUND'; end if;
  if p.status='REALIZED' then return jsonb_build_object('ok',true,'position_id',p_position_id,'status','REALIZED'); end if;
  if p.status<>'FINALIZED' then raise exception 'POSITION_NOT_FINALIZED'; end if;
  select * into s from public.sessions where v515_position_id=p_position_id and deleted_at is null;
  if not found or s.completed_at is null then raise exception 'OPERATIONAL_SESSION_NOT_COMPLETED'; end if;
  if not (public.current_user_is_admin() or s.teacher_id=auth.uid()) then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  update public.v515_session_positions set status='REALIZED',updated_at=now(),updated_by=auth.uid() where id=p_position_id;
  insert into public.v515_audit_log(actor_id,action,entity_type,entity_id,after_state)
  values(auth.uid(),'MARK_REALIZED','v515_position',p_position_id,jsonb_build_object('status','REALIZED','session_id',s.id));
  return jsonb_build_object('ok',true,'position_id',p_position_id,'status','REALIZED','session_id',s.id);
end;
$$;

revoke all on function public.v515_verify_cycle(uuid) from public, anon;
revoke all on function public.v515_finalize_cycle(uuid) from public, anon;
revoke all on function public.v515_mark_realized(uuid) from public, anon;
grant execute on function public.v515_verify_cycle(uuid) to authenticated;
grant execute on function public.v515_finalize_cycle(uuid) to authenticated;
grant execute on function public.v515_mark_realized(uuid) to authenticated;
