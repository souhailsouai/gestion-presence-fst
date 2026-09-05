begin;

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
  v_constraint text;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if not(select private.is_admin()) then
    return jsonb_build_object('ok',false,'code','FORBIDDEN','message','Accès Admin requis.','affected_sessions',0);
  end if;

  if p_effective_date is null then
    return jsonb_build_object('ok',false,'code','EFFECTIVE_DATE_REQUIRED','message','Date d’effet requise.','affected_sessions',0);
  end if;

  select id into v_cycle_id
  from public.v515_cycles
  where academic_year='2026/2027' and semester=1
  limit 1;

  if v_cycle_id is null then
    return jsonb_build_object('ok',false,'code','CYCLE_NOT_FOUND','message','Planning RÉEL non initialisé.','affected_sessions',0);
  end if;

  if exists(
    select 1
    from public.v16_test_sessions ts
    join public.v515_sessions rs on rs.id=ts.real_session_id
    where ts.session_date>=p_effective_date
      and rs.class_name is distinct from ts.class_name
  ) then
    return jsonb_build_object('ok',false,'code','REAL_CALENDAR_RECONCILIATION_REQUIRED','message','Réconcilier le calendrier RÉEL avant TEST → RÉEL.','affected_sessions',0);
  end if;

  if exists(
    select 1
    from public.v16_test_assignments ta
    join public.v16_test_sessions ts on ts.id=ta.test_session_id
    where ts.session_date>=p_effective_date
      and ta.room is null
  ) then
    return jsonb_build_object('ok',false,'code','ROOM_REQUIRED','message','Toutes les salles TEST doivent être choisies.','affected_sessions',0);
  end if;

  if exists(
    select 1
    from public.v16_test_assignments ta
    join public.v16_test_sessions ts on ts.id=ta.test_session_id
    left join public.v515_assignments ra on ra.id=ta.real_assignment_id
    where ts.session_date>=p_effective_date
      and (ta.real_assignment_id is null or ra.id is null)
  ) then
    return jsonb_build_object('ok',false,'code','UNMAPPED_TEST_ASSIGNMENT','message','Une affectation TEST ne correspond à aucune affectation RÉEL.','affected_sessions',0);
  end if;

  if exists(
    select 1
    from public.v16_test_assignments ta
    join public.v16_test_sessions ts on ts.id=ta.test_session_id
    join public.v515_assignments ra on ra.id=ta.real_assignment_id
    join public.v515_sessions rs on rs.id=ts.real_session_id
    left join public.session_plans sp on sp.id=ra.legacy_plan_id
    where ts.session_date>=p_effective_date
      and (
        rs.lifecycle_status='completed'
        or v_local_now >= (rs.session_date::timestamp+rs.start_time)
        or (sp.session_id is not null and sp.deleted_at is null)
      )
  ) then
    return jsonb_build_object('ok',false,'code','SESSION_ALREADY_STARTED','message','Une séance RÉEL a déjà commencé ou est terminée.','affected_sessions',0);
  end if;

  if exists(
    select 1
    from public.v16_test_assignments ta
    join public.v16_test_sessions ts on ts.id=ta.test_session_id
    join public.v515_assignments ra on ra.id=ta.real_assignment_id
    where ts.session_date>=p_effective_date
      and ra.legacy_plan_id is null
  ) then
    return jsonb_build_object('ok',false,'code','UNMAPPED_SESSION_PLAN','message','Une affectation RÉEL ne possède aucun plan lié.','affected_sessions',0);
  end if;

  if exists(
    select 1
    from public.v16_test_assignments ta
    join public.v16_test_sessions ts on ts.id=ta.test_session_id
    left join public.classes c
      on c.name=ts.class_name||'-G'||ta.group_no
     and c.deleted_at is null
    where ts.session_date>=p_effective_date
      and c.id is null
  ) then
    return jsonb_build_object('ok',false,'code','TARGET_CLASS_MISSING','message','Une classe/groupe cible est introuvable.','affected_sessions',0);
  end if;

  for v_week in
    select distinct date_trunc('week',rs.session_date)::date week_start
    from public.v16_test_sessions ts
    join public.v515_sessions rs on rs.id=ts.real_session_id
    where rs.session_date>=p_effective_date
    order by 1
  loop
    v_check:=private.v16_verify_test_apply_week(v_week.week_start,p_effective_date);
    if not coalesce((v_check->>'ok')::boolean,false) then
      return jsonb_build_object(
        'ok',false,
        'code','TEST_WEEK_VALIDATION_FAILED',
        'message','La semaine prospective TEST → RÉEL est invalide.',
        'affected_sessions',0,
        'blockers',coalesce(v_check->'blockers','[]'::jsonb)
      );
    end if;
  end loop;

  create temporary table v16_apply_targets(
    real_assignment_id uuid primary key,
    legacy_plan_id uuid not null,
    real_session_id uuid not null,
    target_class_id uuid not null,
    plan_date date not null,
    teacher_id uuid not null,
    manipulation_code text not null,
    room text not null
  ) on commit drop;

  insert into v16_apply_targets(
    real_assignment_id,legacy_plan_id,real_session_id,target_class_id,
    plan_date,teacher_id,manipulation_code,room
  )
  select
    ra.id,ra.legacy_plan_id,rs.id,c.id,
    rs.session_date,ta.teacher_id,ta.manipulation_code,ta.room
  from public.v16_test_assignments ta
  join public.v16_test_sessions ts on ts.id=ta.test_session_id
  join public.v515_assignments ra on ra.id=ta.real_assignment_id
  join public.v515_sessions rs on rs.id=ts.real_session_id
  join public.classes c
    on c.name=ts.class_name||'-G'||ta.group_no
   and c.deleted_at is null
  where rs.cycle_id=v_cycle_id
    and rs.session_date>=p_effective_date
    and rs.lifecycle_status<>'completed'
    and v_local_now < (rs.session_date::timestamp+rs.start_time);

  if exists(
    select 1
    from public.session_plans stale
    join v16_apply_targets t
      on t.target_class_id=stale.class_id
     and t.plan_date=stale.plan_date
     and t.legacy_plan_id<>stale.id
    where stale.deleted_at is not null
      and (
        stale.session_id is not null
        or exists(
          select 1
          from public.v515_assignments dependency
          where dependency.legacy_plan_id=stale.id
        )
      )
  ) then
    return jsonb_build_object(
      'ok',false,
      'code','SOFT_DELETED_PLAN_CONFLICT_HAS_REFERENCES',
      'message','Un ancien plan en conflit possède encore une référence active.',
      'affected_sessions',0
    );
  end if;

  if exists(
    select 1
    from public.session_plans active
    join v16_apply_targets t
      on t.target_class_id=active.class_id
     and t.plan_date=active.plan_date
     and t.legacy_plan_id<>active.id
    where active.deleted_at is null
  ) then
    return jsonb_build_object(
      'ok',false,
      'code','ACTIVE_PLAN_CLASS_DATE_CONFLICT',
      'message','Un plan actif occupe déjà la classe et la date cibles.',
      'affected_sessions',0
    );
  end if;

  begin
    delete from public.session_plans stale
    using v16_apply_targets t
    where t.target_class_id=stale.class_id
      and t.plan_date=stale.plan_date
      and t.legacy_plan_id<>stale.id
      and stale.deleted_at is not null
      and stale.session_id is null
      and not exists(
        select 1
        from public.v515_assignments dependency
        where dependency.legacy_plan_id=stale.id
      );

    update public.session_plans sp
       set manipulation=null,
           revision=sp.revision+1,
           updated_at=now(),
           updated_by=auth.uid()
      from v16_apply_targets t
     where t.legacy_plan_id=sp.id
       and sp.session_id is null
       and sp.deleted_at is null;

    update public.v515_assignments ra
       set teacher_id=t.teacher_id,
           manipulation_code=t.manipulation_code,
           room=t.room,
           source='admin_direct',
           request_id=null,
           assigned_by=auth.uid()
      from v16_apply_targets t
     where ra.id=t.real_assignment_id;
    get diagnostics v_changed=row_count;

    update public.session_plans sp
       set class_id=t.target_class_id,
           manipulation=t.manipulation_code,
           revision=sp.revision+1,
           updated_at=now(),
           updated_by=auth.uid()
      from v16_apply_targets t
     where t.legacy_plan_id=sp.id
       and sp.session_id is null
       and sp.deleted_at is null;

    update public.session_plans sp
       set teacher_id=t.teacher_id,
           room=t.room,
           revision=sp.revision+1,
           updated_at=now(),
           updated_by=auth.uid()
      from v16_apply_targets t
     where t.legacy_plan_id=sp.id
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
      get stacked diagnostics v_constraint=CONSTRAINT_NAME;
      if v_constraint='session_plans_class_date_uniq' then
        return jsonb_build_object('ok',false,'code','PLAN_CLASS_DATE_CONFLICT','message','Conflit classe/date lors de TEST → RÉEL.','affected_sessions',0);
      end if;
      return jsonb_build_object('ok',false,'code','ROOM_TIME_CONFLICT','message','Conflit de salle lors de TEST → RÉEL.','affected_sessions',0);
    when check_violation then
      if sqlerrm like 'V16_WEEK_VALIDATION_FAILED:%' then
        return jsonb_build_object('ok',false,'code','WEEK_VALIDATION_FAILED','message','Répartition hebdomadaire RÉELLE invalide.','affected_sessions',0,'blockers',coalesce(v_check->'blockers','[]'::jsonb));
      end if;
      raise;
    when raise_exception then
      if sqlerrm like 'Cette manipulation est déjà planifiée%' or sqlerrm='REPEATED_GROUP_MANIPULATION' then
        return jsonb_build_object('ok',false,'code','REPEATED_GROUP_MANIPULATION','message','Un groupe RÉEL répéterait une manipulation.','affected_sessions',0);
      end if;
      raise;
  end;

  select count(distinct real_session_id) into v_sessions
  from v16_apply_targets;

  perform private.v515_audit(
    v_cycle_id,
    'v16_test_structural_plan_applied',
    null,
    'Scénario TEST structurel appliqué au planning RÉEL.',
    jsonb_build_object(
      'effective_date',p_effective_date,
      'affected_sessions',v_sessions,
      'changed_assignments',v_changed
    )
  );

  return jsonb_build_object(
    'ok',true,
    'affected_sessions',v_sessions,
    'changed_assignments',v_changed,
    'effective_date',p_effective_date,
    'blockers','[]'::jsonb,
    'warnings','[]'::jsonb
  );
end;
$$;

revoke execute on function public.v16_apply_test_teacher_plan(date) from public,anon;
grant execute on function public.v16_apply_test_teacher_plan(date) to authenticated;

commit;
