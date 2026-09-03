begin;

create or replace function private.v515_audit(
  p_cycle_id uuid,
  p_event_type text,
  p_error_code text,
  p_message text,
  p_context jsonb default '{}'::jsonb
) returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.v515_audit_log(cycle_id, actor_id, event_type, error_code, message, context)
  values (p_cycle_id, auth.uid(), p_event_type, p_error_code, p_message, coalesce(p_context,'{}'::jsonb));
$$;

revoke execute on function private.v515_audit(uuid,text,text,text,jsonb) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.v515_audit(uuid,text,text,text,jsonb) to authenticated;

create or replace function public.v515_expected_manipulation(p_group_no integer, p_class_occurrence integer)
returns text
language sql
immutable
security invoker
as $$
  select case
    when p_group_no between 1 and 6 and p_class_occurrence >= 1
      then 'M' || ((((p_group_no - 1) + (p_class_occurrence - 1)) % 6) + 1)::text
    else null
  end;
$$;

revoke execute on function public.v515_expected_manipulation(integer,integer) from public, anon;
grant execute on function public.v515_expected_manipulation(integer,integer) to authenticated;

create or replace function public.v515_request_assignment(
  p_session_id uuid,
  p_group_no integer,
  p_manipulation_code text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_session public.v515_sessions%rowtype;
  v_constraint public.v515_teacher_constraints%rowtype;
  v_expected text;
  v_assigned_count integer;
  v_request_id uuid;
begin
  if v_uid is null then raise exception 'authentication required'; end if;

  select * into v_session from public.v515_sessions where id=p_session_id for share;
  if not found or not v_session.is_teaching_session or v_session.lifecycle_status <> 'published' then
    perform private.v515_audit(v_session.cycle_id,'request_rejected','SESSION_NOT_AVAILABLE','Cette séance ne peut pas recevoir de demande.',jsonb_build_object('session_id',p_session_id));
    return jsonb_build_object('ok',false,'code','SESSION_NOT_AVAILABLE','message','Cette séance ne peut pas recevoir de demande.');
  end if;

  if p_group_no < 1 or p_group_no > 6 then
    return jsonb_build_object('ok',false,'code','INVALID_GROUP','message','Groupe invalide.');
  end if;

  v_expected := public.v515_expected_manipulation(p_group_no,v_session.class_occurrence);
  if v_expected is distinct from p_manipulation_code then
    perform private.v515_audit(v_session.cycle_id,'request_rejected','ROTATION_INCONSISTENT','Rotation incohérente avec le cycle M1-M6.',jsonb_build_object('session_id',p_session_id,'group_no',p_group_no,'expected',v_expected,'received',p_manipulation_code));
    return jsonb_build_object('ok',false,'code','ROTATION_INCONSISTENT','message','Rotation incohérente avec le cycle M1-M6.');
  end if;

  select * into v_constraint from public.v515_teacher_constraints
  where cycle_id=v_session.cycle_id and teacher_id=v_uid for update;
  if not found then
    return jsonb_build_object('ok',false,'code','TEACHER_NOT_CONFIGURED','message','Enseignant non configuré pour ce cycle.');
  end if;

  if not (p_manipulation_code = any(v_constraint.allowed_manipulations)) then
    perform private.v515_audit(v_session.cycle_id,'request_rejected','MANIPULATION_NOT_ALLOWED','Manipulation '||p_manipulation_code||' non autorisée pour cet enseignant.',jsonb_build_object('teacher_id',v_uid,'manipulation',p_manipulation_code));
    return jsonb_build_object('ok',false,'code','MANIPULATION_NOT_ALLOWED','message','Manipulation '||p_manipulation_code||' non autorisée pour cet enseignant.');
  end if;

  select count(*) into v_assigned_count from public.v515_assignments
  where cycle_id=v_session.cycle_id and teacher_id=v_uid;
  if v_assigned_count >= v_constraint.quota then
    perform private.v515_audit(v_session.cycle_id,'request_rejected','TEACHER_QUOTA','Quota enseignant atteint.',jsonb_build_object('teacher_id',v_uid,'quota',v_constraint.quota));
    return jsonb_build_object('ok',false,'code','TEACHER_QUOTA','message','Quota enseignant atteint.');
  end if;

  if exists (
    select 1 from public.v515_assignments a
    join public.v515_sessions s on s.id=a.session_id
    where a.teacher_id=v_uid and s.session_date=v_session.session_date
      and s.start_time < v_session.end_time and s.end_time > v_session.start_time
  ) then
    return jsonb_build_object('ok',false,'code','TEACHER_TIME_CONFLICT','message','Enseignant déjà affecté sur ce créneau.');
  end if;

  insert into public.v515_requests(cycle_id,session_id,group_no,manipulation_code,teacher_id,status)
  values(v_session.cycle_id,p_session_id,p_group_no,p_manipulation_code,v_uid,'pending')
  returning id into v_request_id;

  return jsonb_build_object('ok',true,'request_id',v_request_id);
exception
  when unique_violation then
    perform private.v515_audit(v_session.cycle_id,'request_rejected','DUPLICATE_REQUEST','Une demande existe déjà pour cette séance.',jsonb_build_object('session_id',p_session_id,'teacher_id',v_uid));
    return jsonb_build_object('ok',false,'code','DUPLICATE_REQUEST','message','Une demande existe déjà pour cette séance.');
end;
$$;

create or replace function public.v515_cancel_request(p_request_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_request public.v515_requests%rowtype;
begin
  if v_uid is null then raise exception 'authentication required'; end if;
  select * into v_request from public.v515_requests where id=p_request_id for update;
  if not found then return jsonb_build_object('ok',false,'code','REQUEST_NOT_FOUND','message','Demande introuvable.'); end if;
  if v_request.status <> 'pending' then return jsonb_build_object('ok',false,'code','REQUEST_NOT_PENDING','message','Cette demande ne peut plus être annulée.'); end if;
  if v_request.teacher_id <> v_uid and not (select private.is_admin()) then
    return jsonb_build_object('ok',false,'code','FORBIDDEN','message','Modification non autorisée.');
  end if;
  update public.v515_requests set status='cancelled',updated_at=now() where id=p_request_id;
  return jsonb_build_object('ok',true);
end;
$$;

create or replace function public.v515_assign_teacher(
  p_session_id uuid,
  p_group_no integer,
  p_manipulation_code text,
  p_teacher_id uuid
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_session public.v515_sessions%rowtype;
  v_constraint public.v515_teacher_constraints%rowtype;
  v_expected text;
  v_assigned_count integer;
  v_assignment_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not (select private.is_admin()) then return jsonb_build_object('ok',false,'code','FORBIDDEN','message','Accès Admin requis.'); end if;

  select * into v_session from public.v515_sessions where id=p_session_id for update;
  if not found or not v_session.is_teaching_session or v_session.lifecycle_status not in ('published','assignments_finalized') then
    return jsonb_build_object('ok',false,'code','SESSION_NOT_AVAILABLE','message','Cette séance ne peut pas être attribuée.');
  end if;
  if v_session.completed_at is not null or v_session.lifecycle_status='completed' then
    return jsonb_build_object('ok',false,'code','COMPLETED_SESSION','message','Une séance réalisée ne peut pas être modifiée.');
  end if;

  v_expected := public.v515_expected_manipulation(p_group_no,v_session.class_occurrence);
  if v_expected is distinct from p_manipulation_code then
    return jsonb_build_object('ok',false,'code','ROTATION_INCONSISTENT','message','Rotation incohérente avec le cycle M1-M6.');
  end if;

  select * into v_constraint from public.v515_teacher_constraints
  where cycle_id=v_session.cycle_id and teacher_id=p_teacher_id for update;
  if not found then return jsonb_build_object('ok',false,'code','TEACHER_NOT_CONFIGURED','message','Enseignant non configuré pour ce cycle.'); end if;
  if not (p_manipulation_code = any(v_constraint.allowed_manipulations)) then
    return jsonb_build_object('ok',false,'code','MANIPULATION_NOT_ALLOWED','message','Manipulation '||p_manipulation_code||' non autorisée pour cet enseignant.');
  end if;

  select count(*) into v_assigned_count from public.v515_assignments where cycle_id=v_session.cycle_id and teacher_id=p_teacher_id;
  if v_assigned_count >= v_constraint.quota then return jsonb_build_object('ok',false,'code','TEACHER_QUOTA','message','Quota enseignant atteint.'); end if;

  if exists (
    select 1 from public.v515_assignments a join public.v515_sessions s on s.id=a.session_id
    where a.teacher_id=p_teacher_id and s.session_date=v_session.session_date
      and s.start_time < v_session.end_time and s.end_time > v_session.start_time
  ) then
    return jsonb_build_object('ok',false,'code','TEACHER_TIME_CONFLICT','message','Enseignant déjà affecté sur ce créneau.');
  end if;

  insert into public.v515_assignments(cycle_id,session_id,group_no,manipulation_code,teacher_id,source,assigned_by)
  values(v_session.cycle_id,p_session_id,p_group_no,p_manipulation_code,p_teacher_id,'admin_direct',auth.uid())
  returning id into v_assignment_id;

  perform private.v515_audit(v_session.cycle_id,'assignment_created',null,'Affectation directe Admin créée.',jsonb_build_object('assignment_id',v_assignment_id,'teacher_id',p_teacher_id));
  return jsonb_build_object('ok',true,'assignment_id',v_assignment_id);
exception
  when unique_violation then
    perform private.v515_audit(v_session.cycle_id,'assignment_rejected','DUPLICATE_ASSIGNMENT','Cette séance a déjà été attribuée.',jsonb_build_object('session_id',p_session_id,'group_no',p_group_no));
    return jsonb_build_object('ok',false,'code','DUPLICATE_ASSIGNMENT','message','Cette séance a déjà été attribuée.');
end;
$$;

create or replace function public.v515_validate_request(p_request_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_request public.v515_requests%rowtype;
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not (select private.is_admin()) then return jsonb_build_object('ok',false,'code','FORBIDDEN','message','Accès Admin requis.'); end if;

  select * into v_request from public.v515_requests where id=p_request_id for update;
  if not found then return jsonb_build_object('ok',false,'code','REQUEST_NOT_FOUND','message','Demande introuvable.'); end if;
  if v_request.status <> 'pending' then return jsonb_build_object('ok',false,'code','REQUEST_NOT_PENDING','message','Cette demande a déjà été traitée.'); end if;

  v_result := public.v515_assign_teacher(v_request.session_id,v_request.group_no,v_request.manipulation_code,v_request.teacher_id);
  if coalesce((v_result->>'ok')::boolean,false) then
    update public.v515_assignments set source='request_validation',request_id=p_request_id where id=(v_result->>'assignment_id')::uuid;
    update public.v515_requests set status='validated',updated_at=now() where id=p_request_id;
  end if;
  return v_result;
end;
$$;

create or replace function public.v515_finalize_assignments(p_cycle_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_group_count integer;
  v_expected integer;
  v_actual integer;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not (select private.is_admin()) then return jsonb_build_object('ok',false,'code','FORBIDDEN','message','Accès Admin requis.'); end if;

  select group_count into v_group_count from public.v515_cycles where id=p_cycle_id for update;
  if not found then return jsonb_build_object('ok',false,'code','CYCLE_NOT_FOUND','message','Cycle introuvable.'); end if;

  select count(*)*v_group_count into v_expected from public.v515_sessions where cycle_id=p_cycle_id and is_teaching_session and lifecycle_status in ('published','assignments_finalized');
  select count(*) into v_actual from public.v515_assignments where cycle_id=p_cycle_id;
  if v_actual <> v_expected then
    return jsonb_build_object('ok',false,'code','VACANT_POSTS','message','Impossible de finaliser : '||(v_expected-v_actual)||' postes restent sans enseignant.','missing',v_expected-v_actual);
  end if;

  update public.v515_cycles set status='assignments_finalized',updated_at=now() where id=p_cycle_id;
  update public.v515_sessions set lifecycle_status='assignments_finalized',updated_at=now() where cycle_id=p_cycle_id and is_teaching_session and lifecycle_status='published';
  perform private.v515_audit(p_cycle_id,'assignments_finalized',null,'Affectations finalisées.','{}'::jsonb);
  return jsonb_build_object('ok',true);
end;
$$;

create or replace function public.v515_close_cycle(p_cycle_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_group_count integer;
  v_missing integer;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not (select private.is_admin()) then return jsonb_build_object('ok',false,'code','FORBIDDEN','message','Accès Admin requis.'); end if;

  select group_count into v_group_count from public.v515_cycles where id=p_cycle_id and status='assignments_finalized' for update;
  if not found then return jsonb_build_object('ok',false,'code','INVALID_CYCLE_STATE','message','Les affectations doivent être finalisées avant la clôture pédagogique.'); end if;

  with classes as (
    select distinct class_name from public.v515_sessions where cycle_id=p_cycle_id and is_teaching_session
  ), expected as (
    select c.class_name,g.group_no,m.code
    from classes c
    cross join generate_series(1,v_group_count) as g(group_no)
    cross join public.v515_manipulations m
    where m.active
  ), completed as (
    select distinct s.class_name,a.group_no,a.manipulation_code as code
    from public.v515_sessions s
    join public.v515_assignments a on a.session_id=s.id
    where s.cycle_id=p_cycle_id and s.is_teaching_session and s.completed_at is not null
  ), missing as (
    select e.* from expected e
    left join completed c using(class_name,group_no,code)
    left join public.v515_waivers w on w.cycle_id=p_cycle_id and w.class_name=e.class_name and w.group_no=e.group_no and w.manipulation_code=e.code
    where c.code is null and w.id is null
  ) select count(*) into v_missing from missing;

  if v_missing>0 then
    return jsonb_build_object('ok',false,'code','CYCLE_INCOMPLETE','message','Cycle incomplet : des manipulations M1-M6 restent à réaliser.','missing',v_missing);
  end if;

  update public.v515_cycles set status='cycle_closed',updated_at=now() where id=p_cycle_id;
  perform private.v515_audit(p_cycle_id,'cycle_closed',null,'Cycle pédagogique clôturé.','{}'::jsonb);
  return jsonb_build_object('ok',true);
end;
$$;

revoke execute on function public.v515_request_assignment(uuid,integer,text) from public, anon;
revoke execute on function public.v515_cancel_request(uuid) from public, anon;
revoke execute on function public.v515_assign_teacher(uuid,integer,text,uuid) from public, anon;
revoke execute on function public.v515_validate_request(uuid) from public, anon;
revoke execute on function public.v515_finalize_assignments(uuid) from public, anon;
revoke execute on function public.v515_close_cycle(uuid) from public, anon;

grant execute on function public.v515_request_assignment(uuid,integer,text) to authenticated;
grant execute on function public.v515_cancel_request(uuid) to authenticated;
grant execute on function public.v515_assign_teacher(uuid,integer,text,uuid) to authenticated;
grant execute on function public.v515_validate_request(uuid) to authenticated;
grant execute on function public.v515_finalize_assignments(uuid) to authenticated;
grant execute on function public.v515_close_cycle(uuid) to authenticated;

commit;
