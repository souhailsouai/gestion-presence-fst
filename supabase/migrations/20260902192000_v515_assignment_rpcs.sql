-- V5.15 teacher configuration, requests, quotas, and assignments.

create or replace function public.v515_set_teacher_config(
  p_teacher_id uuid,
  p_quota integer,
  p_active boolean,
  p_manipulations text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare before_state jsonb; clean_manips text[];
begin
  if auth.uid() is null or not public.current_user_is_admin() then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
  if p_quota is null or p_quota < 0 then raise exception 'INVALID_QUOTA'; end if;
  if not exists(select 1 from public.profiles where id=p_teacher_id and deleted_at is null and role in ('teacher','admin')) then
    raise exception 'TEACHER_NOT_FOUND';
  end if;
  if exists(
    select 1 from unnest(coalesce(p_manipulations,array[]::text[])) x
    where x not in ('M1','M2','M3','M4','M5','M6')
  ) then raise exception 'INVALID_MANIPULATION'; end if;

  select jsonb_build_object(
    'quota',tc.quota,'active',tc.active,
    'manipulations',coalesce((select jsonb_agg(tm.manipulation_code order by tm.manipulation_code)
      from public.v515_teacher_manipulations tm where tm.teacher_id=p_teacher_id),'[]'::jsonb)
  ) into before_state
  from public.v515_teacher_config tc where tc.teacher_id=p_teacher_id;

  insert into public.v515_teacher_config(teacher_id,quota,active,updated_by)
  values(p_teacher_id,p_quota,coalesce(p_active,true),auth.uid())
  on conflict(teacher_id) do update set
    quota=excluded.quota,active=excluded.active,updated_at=now(),updated_by=auth.uid();

  select coalesce(array_agg(distinct x order by x),array[]::text[]) into clean_manips
  from unnest(coalesce(p_manipulations,array[]::text[])) x;
  delete from public.v515_teacher_manipulations where teacher_id=p_teacher_id;
  insert into public.v515_teacher_manipulations(teacher_id,manipulation_code)
  select p_teacher_id,x from unnest(clean_manips) x;

  insert into public.v515_audit_log(actor_id,action,entity_type,entity_id,before_state,after_state)
  values(auth.uid(),'SET_TEACHER_CONFIG','v515_teacher',p_teacher_id,before_state,
    jsonb_build_object('quota',p_quota,'active',coalesce(p_active,true),'manipulations',to_jsonb(clean_manips)));

  return jsonb_build_object('ok',true,'teacher_id',p_teacher_id,'quota',p_quota,'active',coalesce(p_active,true),'manipulations',to_jsonb(clean_manips));
end;
$$;

create or replace function public.v515_submit_request(p_position_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare p public.v515_session_positions%rowtype; cfg public.v515_teacher_config%rowtype; req public.v515_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode='42501'; end if;
  select * into p from public.v515_session_positions where id=p_position_id for update;
  if not found then raise exception 'POSITION_NOT_FOUND'; end if;
  if p.status<>'OPEN' then raise exception 'POSITION_NOT_OPEN'; end if;
  if not exists(select 1 from public.v515_cycles c where c.id=p.cycle_id and c.status in ('OPEN_FOR_REQUESTS','ASSIGNMENT')) then
    raise exception 'CYCLE_NOT_OPEN';
  end if;
  select * into cfg from public.v515_teacher_config where teacher_id=auth.uid();
  if not found or not cfg.active then raise exception 'TEACHER_INACTIVE'; end if;
  if not exists(select 1 from public.v515_teacher_manipulations where teacher_id=auth.uid() and manipulation_code=p.manipulation_code) then
    raise exception 'MANIPULATION_NOT_ALLOWED';
  end if;

  select * into req from public.v515_requests where position_id=p_position_id and teacher_id=auth.uid() for update;
  if found then
    if req.status='PENDING' then return jsonb_build_object('ok',true,'request_id',req.id,'status','PENDING'); end if;
    if req.status='CANCELLED' then
      update public.v515_requests set status='PENDING',updated_at=now(),decided_at=null,decided_by=null where id=req.id returning * into req;
      return jsonb_build_object('ok',true,'request_id',req.id,'status','PENDING');
    end if;
    raise exception 'REQUEST_NOT_REOPENABLE';
  end if;

  insert into public.v515_requests(position_id,teacher_id,status)
  values(p_position_id,auth.uid(),'PENDING') returning * into req;
  return jsonb_build_object('ok',true,'request_id',req.id,'status',req.status);
end;
$$;

create or replace function public.v515_cancel_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare r public.v515_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode='42501'; end if;
  select * into r from public.v515_requests where id=p_request_id for update;
  if not found or r.teacher_id<>auth.uid() then raise exception 'REQUEST_NOT_FOUND' using errcode='42501'; end if;
  if r.status<>'PENDING' then raise exception 'REQUEST_NOT_PENDING'; end if;
  update public.v515_requests set status='CANCELLED',updated_at=now(),decided_at=now(),decided_by=auth.uid() where id=p_request_id;
  return jsonb_build_object('ok',true,'request_id',p_request_id,'status','CANCELLED');
end;
$$;

create or replace function public.v515_assert_assignment_allowed(p_position_id uuid,p_teacher_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare p public.v515_session_positions%rowtype; cfg public.v515_teacher_config%rowtype; used_count integer;
begin
  if auth.uid() is null or not public.current_user_is_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  select * into p from public.v515_session_positions where id=p_position_id for update;
  if not found then raise exception 'POSITION_NOT_FOUND'; end if;
  if p.status<>'OPEN' then
    if exists(select 1 from public.v515_assignments where position_id=p_position_id) then raise exception 'POSITION_ALREADY_ASSIGNED'; end if;
    raise exception 'POSITION_NOT_OPEN';
  end if;
  if exists(select 1 from public.v515_assignments where position_id=p_position_id) then raise exception 'POSITION_ALREADY_ASSIGNED'; end if;
  if not exists(select 1 from public.v515_cycles where id=p.cycle_id and status in ('OPEN_FOR_REQUESTS','ASSIGNMENT')) then raise exception 'CYCLE_NOT_OPEN'; end if;

  select * into cfg from public.v515_teacher_config where teacher_id=p_teacher_id for update;
  if not found or not cfg.active then raise exception 'TEACHER_INACTIVE'; end if;
  if not exists(select 1 from public.profiles where id=p_teacher_id and deleted_at is null and account_state<>'disabled') then raise exception 'TEACHER_INACTIVE'; end if;
  if not exists(select 1 from public.v515_teacher_manipulations where teacher_id=p_teacher_id and manipulation_code=p.manipulation_code) then
    raise exception 'MANIPULATION_NOT_ALLOWED';
  end if;

  select count(*) into used_count from public.v515_assignments where teacher_id=p_teacher_id;
  if used_count>=cfg.quota then raise exception 'QUOTA_REACHED'; end if;

  if exists(
    select 1
    from public.v515_assignments a
    join public.v515_session_positions q on q.id=a.position_id
    where a.teacher_id=p_teacher_id
      and q.status not in ('CANCELLED')
      and q.session_date=p.session_date
      and q.start_time < p.end_time
      and q.end_time > p.start_time
  ) then raise exception 'TEACHER_OVERLAP'; end if;
end;
$$;

create or replace function public.v515_accept_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare r public.v515_requests%rowtype; a_id uuid; cycle_id uuid;
begin
  if auth.uid() is null or not public.current_user_is_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  select * into r from public.v515_requests where id=p_request_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if r.status<>'PENDING' then raise exception 'REQUEST_NOT_PENDING'; end if;
  perform public.v515_assert_assignment_allowed(r.position_id,r.teacher_id);
  insert into public.v515_assignments(position_id,teacher_id,request_id,assigned_by)
  values(r.position_id,r.teacher_id,r.id,auth.uid()) returning id into a_id;
  update public.v515_requests set status='ACCEPTED',updated_at=now(),decided_at=now(),decided_by=auth.uid() where id=r.id;
  update public.v515_requests set status='REJECTED',updated_at=now(),decided_at=now(),decided_by=auth.uid()
    where position_id=r.position_id and id<>r.id and status='PENDING';
  update public.v515_session_positions set status='ASSIGNED',updated_at=now(),updated_by=auth.uid() where id=r.position_id returning cycle_id into cycle_id;
  update public.v515_cycles set status='ASSIGNMENT',updated_at=now(),updated_by=auth.uid()
    where id=cycle_id and status='OPEN_FOR_REQUESTS';
  insert into public.v515_audit_log(actor_id,action,entity_type,entity_id,after_state)
  values(auth.uid(),'ACCEPT_REQUEST','v515_assignment',a_id,
    jsonb_build_object('position_id',r.position_id,'teacher_id',r.teacher_id,'request_id',r.id));
  return jsonb_build_object('ok',true,'assignment_id',a_id,'position_id',r.position_id,'teacher_id',r.teacher_id);
end;
$$;

create or replace function public.v515_reject_request(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare r public.v515_requests%rowtype;
begin
  if auth.uid() is null or not public.current_user_is_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  select * into r from public.v515_requests where id=p_request_id for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if r.status<>'PENDING' then raise exception 'REQUEST_NOT_PENDING'; end if;
  update public.v515_requests set status='REJECTED',updated_at=now(),decided_at=now(),decided_by=auth.uid() where id=p_request_id;
  insert into public.v515_audit_log(actor_id,action,entity_type,entity_id,after_state)
  values(auth.uid(),'REJECT_REQUEST','v515_request',p_request_id,jsonb_build_object('status','REJECTED','teacher_id',r.teacher_id,'position_id',r.position_id));
  return jsonb_build_object('ok',true,'request_id',p_request_id,'status','REJECTED');
end;
$$;

create or replace function public.v515_direct_assign(p_position_id uuid,p_teacher_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare a_id uuid; cycle_id uuid;
begin
  if auth.uid() is null or not public.current_user_is_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  perform public.v515_assert_assignment_allowed(p_position_id,p_teacher_id);
  insert into public.v515_assignments(position_id,teacher_id,assigned_by)
  values(p_position_id,p_teacher_id,auth.uid()) returning id into a_id;
  update public.v515_requests set status='REJECTED',updated_at=now(),decided_at=now(),decided_by=auth.uid()
    where position_id=p_position_id and status='PENDING';
  update public.v515_session_positions set status='ASSIGNED',updated_at=now(),updated_by=auth.uid() where id=p_position_id returning cycle_id into cycle_id;
  update public.v515_cycles set status='ASSIGNMENT',updated_at=now(),updated_by=auth.uid()
    where id=cycle_id and status='OPEN_FOR_REQUESTS';
  insert into public.v515_audit_log(actor_id,action,entity_type,entity_id,after_state)
  values(auth.uid(),'DIRECT_ASSIGN','v515_assignment',a_id,jsonb_build_object('position_id',p_position_id,'teacher_id',p_teacher_id));
  return jsonb_build_object('ok',true,'assignment_id',a_id,'position_id',p_position_id,'teacher_id',p_teacher_id);
end;
$$;

revoke all on function public.v515_set_teacher_config(uuid,integer,boolean,text[]) from public, anon;
revoke all on function public.v515_submit_request(uuid) from public, anon;
revoke all on function public.v515_cancel_request(uuid) from public, anon;
revoke all on function public.v515_assert_assignment_allowed(uuid,uuid) from public, anon;
revoke all on function public.v515_accept_request(uuid) from public, anon;
revoke all on function public.v515_reject_request(uuid) from public, anon;
revoke all on function public.v515_direct_assign(uuid,uuid) from public, anon;
grant execute on function public.v515_set_teacher_config(uuid,integer,boolean,text[]) to authenticated;
grant execute on function public.v515_submit_request(uuid) to authenticated;
grant execute on function public.v515_cancel_request(uuid) to authenticated;
grant execute on function public.v515_accept_request(uuid) to authenticated;
grant execute on function public.v515_reject_request(uuid) to authenticated;
grant execute on function public.v515_direct_assign(uuid,uuid) to authenticated;
-- Helper is not directly exposed; callers use accept/direct-assign.
