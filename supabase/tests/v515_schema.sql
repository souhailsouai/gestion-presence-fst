begin;

do $$
declare
  v_year uuid;
  v_cycle uuid;
  v_class uuid;
begin
  select id into v_year from public.academic_years limit 1;
  if v_year is null then
    insert into public.academic_years(code, starts_on, ends_on, is_active)
    values ('V515-TEST', date '2026-09-01', date '2027-06-30', false)
    returning id into v_year;
  end if;

  insert into public.v515_cycles(academic_year_id,name,start_date,end_date,week_a_anchor_date)
  values(v_year,'schema-test',date '2026-09-01',date '2026-12-31',date '2026-09-07')
  returning id into v_cycle;

  begin
    insert into public.v515_class_config(cycle_id,class_key,display_name,group_count)
    values(v_cycle,'INVALID','Invalid',7);
    raise exception 'expected group_count check violation';
  exception when check_violation then null;
  end;

  insert into public.v515_class_config(cycle_id,class_key,display_name,group_count)
  values(v_cycle,'MPI1-A','MPI1-A',4)
  returning id into v_class;

  begin
    insert into public.v515_rotation(cycle_id,class_config_id,pedagogical_session_no,group_no,manipulation_code)
    values(v_cycle,v_class,1,1,'M7');
    raise exception 'expected manipulation check violation';
  exception when check_violation then null;
  end;

  begin
    update public.v515_cycles set status='BROKEN' where id=v_cycle;
    raise exception 'expected lifecycle check violation';
  exception when check_violation then null;
  end;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname='public'
      and indexname='sessions_v515_position_uidx'
  ) then
    raise exception 'missing sessions_v515_position_uidx';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid='public.v515_assignments'::regclass
      and contype='u'
  ) then
    raise exception 'missing unique assignment constraint';
  end if;
end $$;

rollback;
