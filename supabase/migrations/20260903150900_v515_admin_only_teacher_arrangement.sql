begin;

revoke execute on function public.v515_request_assignment(uuid,integer,text) from authenticated;
revoke execute on function public.v515_cancel_request(uuid) from authenticated;
revoke execute on function public.v515_validate_request(uuid,text) from authenticated;

create or replace function public.v515_assign_teacher(
  p_session_id uuid,
  p_group_no integer,
  p_manipulation_code text,
  p_teacher_id uuid,
  p_room text
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_s public.v515_sessions%rowtype;
  v_expected text;
  v_fixed_room text;
  v_weekday text;
  v_id uuid;
  v_existing public.v515_assignments%rowtype;
  v_local_now timestamp:=timezone('Africa/Tunis',now());
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not(select private.is_admin()) then
    return jsonb_build_object('ok',false,'code','FORBIDDEN','message','Accès Admin requis.');
  end if;

  select * into v_s from public.v515_sessions where id=p_session_id for update;
  if not found or not v_s.is_teaching_session or v_s.lifecycle_status not in ('published','assignments_finalized') then
    return jsonb_build_object('ok',false,'code','SESSION_NOT_AVAILABLE','message','Cette séance ne peut pas être attribuée.');
  end if;

  if v_local_now >= (v_s.session_date::timestamp + v_s.start_time) then
    return jsonb_build_object('ok',false,'code','SESSION_ALREADY_STARTED','message','Séance démarrée : l’affectation enseignant est verrouillée.');
  end if;

  if p_group_no<1 or p_group_no>(select group_count from public.v515_cycles where id=v_s.cycle_id) then
    return jsonb_build_object('ok',false,'code','INVALID_GROUP','message','Groupe invalide.');
  end if;

  v_expected:=public.v515_expected_manipulation(p_group_no,v_s.class_occurrence);
  if v_expected is distinct from p_manipulation_code then
    return jsonb_build_object('ok',false,'code','ROTATION_INCONSISTENT','message','Rotation incohérente avec le cycle M1-M6.');
  end if;

  select weekday into v_weekday from public.v515_class_pairs where id=v_s.pair_id;
  if not exists(
    select 1 from public.v515_teacher_day_pool p
    where p.cycle_id=v_s.cycle_id and p.weekday=v_weekday and p.teacher_id=p_teacher_id and p.active
  ) then
    return jsonb_build_object('ok',false,'code','TEACHER_NOT_ALLOWED_TODAY','message','Cet enseignant n’est pas prévu pour ce jour dans le planning PDF.');
  end if;

  select room into v_fixed_room from public.v515_manipulation_rooms where manipulation_code=p_manipulation_code;
  if v_fixed_room is null or p_room is distinct from v_fixed_room then
    return jsonb_build_object('ok',false,'code','ROOM_NOT_ALLOWED','message','Salle imposée pour '||p_manipulation_code||' : '||coalesce(v_fixed_room,'indéfinie')||'.');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('v515-teacher|'||p_teacher_id::text||'|'||v_s.session_date::text,0));

  if exists(
    select 1 from public.v515_assignments a
    join public.v515_sessions s on s.id=a.session_id
    where a.teacher_id=p_teacher_id
      and a.session_id<>p_session_id
      and s.session_date=v_s.session_date
      and s.start_time<v_s.end_time
      and s.end_time>v_s.start_time
  ) then
    return jsonb_build_object('ok',false,'code','TEACHER_TIME_CONFLICT','message','Enseignant déjà affecté sur ce créneau.');
  end if;

  select * into v_existing
  from public.v515_assignments
  where session_id=p_session_id and group_no=p_group_no
  for update;

  insert into public.v515_assignments(
    cycle_id,session_id,group_no,manipulation_code,teacher_id,room,source,assigned_by
  ) values(
    v_s.cycle_id,p_session_id,p_group_no,p_manipulation_code,p_teacher_id,v_fixed_room,'admin_direct',auth.uid()
  )
  on conflict(session_id,group_no) do update
    set manipulation_code=excluded.manipulation_code,
        teacher_id=excluded.teacher_id,
        room=excluded.room,
        source='admin_direct',
        request_id=null,
        assigned_by=auth.uid()
  returning id into v_id;

  if v_existing.legacy_plan_id is not null then
    update public.session_plans
      set teacher_id=p_teacher_id, updated_at=now()
    where id=v_existing.legacy_plan_id;
  end if;

  perform private.v515_audit(
    v_s.cycle_id,
    case when v_existing.id is null then 'assignment_created' else 'assignment_updated' end,
    null,
    case when v_existing.id is null then 'Affectation créée par Admin.' else 'Affectation enseignant modifiée par Admin.' end,
    jsonb_build_object('assignment_id',v_id,'teacher_id',p_teacher_id,'room',v_fixed_room,'session_id',p_session_id,'group_no',p_group_no)
  );

  return jsonb_build_object('ok',true,'assignment_id',v_id,'updated',v_existing.id is not null);
end;
$$;

revoke execute on function public.v515_assign_teacher(uuid,integer,text,uuid,text) from public,anon;
grant execute on function public.v515_assign_teacher(uuid,integer,text,uuid,text) to authenticated;

commit;
