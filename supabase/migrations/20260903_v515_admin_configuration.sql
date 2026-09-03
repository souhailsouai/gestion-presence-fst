begin;

create or replace function public.v515_set_teacher_constraints(
  p_cycle_id uuid,
  p_teacher_id uuid,
  p_quota integer,
  p_allowed_manipulations text[]
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not (select private.is_admin()) then return jsonb_build_object('ok',false,'code','FORBIDDEN','message','Accès Admin requis.'); end if;
  if p_quota < 0 then return jsonb_build_object('ok',false,'code','INVALID_QUOTA','message','Quota invalide.'); end if;
  if not coalesce(p_allowed_manipulations,'{}'::text[]) <@ array['M1','M2','M3','M4','M5','M6']::text[] then
    return jsonb_build_object('ok',false,'code','INVALID_MANIPULATION','message','Liste de manipulations invalide.');
  end if;
  if not exists(select 1 from public.profiles where id=p_teacher_id and role in ('teacher','admin') and deleted_at is null) then
    return jsonb_build_object('ok',false,'code','TEACHER_NOT_FOUND','message','Enseignant introuvable.');
  end if;

  insert into public.v515_teacher_constraints(cycle_id,teacher_id,quota,allowed_manipulations,updated_at)
  values(p_cycle_id,p_teacher_id,p_quota,coalesce(p_allowed_manipulations,'{}'::text[]),now())
  on conflict(cycle_id,teacher_id) do update
    set quota=excluded.quota,allowed_manipulations=excluded.allowed_manipulations,updated_at=now();

  perform private.v515_audit(p_cycle_id,'teacher_constraints_updated',null,'Contraintes enseignant mises à jour.',jsonb_build_object('teacher_id',p_teacher_id,'quota',p_quota,'allowed_manipulations',p_allowed_manipulations));
  return jsonb_build_object('ok',true);
end;
$$;

create or replace function public.v515_set_group_count(p_cycle_id uuid,p_group_count integer)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_class text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not (select private.is_admin()) then return jsonb_build_object('ok',false,'code','FORBIDDEN','message','Accès Admin requis.'); end if;
  if p_group_count < 1 or p_group_count > 6 then return jsonb_build_object('ok',false,'code','INVALID_GROUP_COUNT','message','Le nombre de groupes doit être compris entre 1 et 6.'); end if;

  perform 1 from public.v515_cycles where id=p_cycle_id and status in ('draft','published') for update;
  if not found then return jsonb_build_object('ok',false,'code','INVALID_CYCLE_STATE','message','Le nombre de groupes ne peut plus être modifié pour ce cycle.'); end if;
  if exists(select 1 from public.v515_sessions where cycle_id=p_cycle_id and completed_at is not null) then
    return jsonb_build_object('ok',false,'code','COMPLETED_SESSION','message','Une séance réalisée empêche le changement du nombre de groupes.');
  end if;

  delete from public.v515_assignments where cycle_id=p_cycle_id and group_no>p_group_count;
  delete from public.v515_requests where cycle_id=p_cycle_id and group_no>p_group_count;
  delete from public.v515_groups where cycle_id=p_cycle_id and group_no>p_group_count;

  for v_class in select distinct class_name from public.v515_sessions where cycle_id=p_cycle_id and is_teaching_session and class_name is not null
  loop
    insert into public.v515_groups(cycle_id,class_name,group_no)
    select p_cycle_id,v_class,g from generate_series(1,p_group_count) g
    on conflict(cycle_id,class_name,group_no) do update set active=true;
  end loop;

  update public.v515_cycles set group_count=p_group_count,updated_at=now() where id=p_cycle_id;
  perform private.v515_audit(p_cycle_id,'group_count_updated',null,'Nombre de groupes mis à jour.',jsonb_build_object('group_count',p_group_count));
  return jsonb_build_object('ok',true,'group_count',p_group_count);
end;
$$;

revoke execute on function public.v515_set_teacher_constraints(uuid,uuid,integer,text[]) from public, anon;
revoke execute on function public.v515_set_group_count(uuid,integer) from public, anon;
grant execute on function public.v515_set_teacher_constraints(uuid,uuid,integer,text[]) to authenticated;
grant execute on function public.v515_set_group_count(uuid,integer) to authenticated;

commit;
