begin;

-- Serialize the strict class/group/manipulation invariant so two concurrent
-- Admin saves cannot both validate the same new manipulation as available.
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
  select s.cycle_id,s.class_name
    into v_cycle_id,v_class_name
  from public.v515_sessions s
  where s.id=new.session_id;

  if v_cycle_id is null or v_class_name is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'v16-real-manip|' || v_cycle_id::text || '|' || v_class_name || '|' ||
      new.group_no::text || '|' || new.manipulation_code,
      0
    )
  );

  if exists(
    select 1
    from public.v515_assignments a
    join public.v515_sessions s on s.id=a.session_id
    where s.cycle_id=v_cycle_id
      and s.class_name=v_class_name
      and a.group_no=new.group_no
      and a.manipulation_code=new.manipulation_code
      and a.id is distinct from new.id
  ) then
    raise exception using errcode='23514',message='REPEATED_GROUP_MANIPULATION';
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
  v_session_date date;
begin
  select s.class_name,s.session_date
    into v_class_name,v_session_date
  from public.v16_test_sessions s
  where s.id=new.test_session_id;

  if v_class_name is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'v16-test-manip|' || v_class_name || '|' || new.group_no::text || '|' || new.manipulation_code,
      0
    )
  );

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

  -- Preserve history before the TEST effective window. Rows already cloned into
  -- TEST are checked above; only earlier REAL rows remain authoritative here.
  if exists(
    select 1
    from public.v515_assignments ra
    join public.v515_sessions rs on rs.id=ra.session_id
    where rs.class_name=v_class_name
      and ra.group_no=new.group_no
      and ra.manipulation_code=new.manipulation_code
      and rs.session_date<v_session_date
      and not exists(
        select 1
        from public.v16_test_assignments ta2
        where ta2.real_assignment_id=ra.id
      )
  ) then
    raise exception using errcode='23514',message='REPEATED_GROUP_MANIPULATION';
  end if;

  return new;
end;
$$;

commit;
