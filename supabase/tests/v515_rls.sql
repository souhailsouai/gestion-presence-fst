begin;

do $$
declare t text;
begin
  foreach t in array array[
    'v515_cycles','v515_class_config','v515_group_rosters','v515_timeslots','v515_fortnight_pairs',
    'v515_rotation','v515_teacher_config','v515_teacher_manipulations','v515_session_positions',
    'v515_requests','v515_assignments','v515_audit_log'
  ] loop
    if not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=t and c.relrowsecurity) then
      raise exception 'RLS not enabled on %',t;
    end if;
  end loop;
end $$;

do $$
begin
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='v515_requests' and qual ilike '%auth.uid%') then
    raise exception 'own-request select policy missing';
  end if;
  if not exists(select 1 from pg_policies where schemaname='public' and tablename='v515_assignments' and qual ilike '%auth.uid%') then
    raise exception 'own-assignment select policy missing';
  end if;
end $$;

rollback;
