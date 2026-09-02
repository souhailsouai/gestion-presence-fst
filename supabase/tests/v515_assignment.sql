begin;
-- Behavioral integration cases are exercised in the disposable CI database.
-- The critical overlap predicate is half-open: [start_time,end_time), so
-- an assignment ending exactly when the next begins is permitted.
do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='v515_assert_assignment_allowed'
  ) then raise exception 'assignment guard missing'; end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='v515_accept_request'
  ) then raise exception 'accept request RPC missing'; end if;
end $$;

-- Verify assignments remain one-per-position at the schema level.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid='public.v515_assignments'::regclass
      and contype='u'
      and pg_get_constraintdef(oid) ilike '%position_id%'
  ) then raise exception 'one-assignment-per-position constraint missing'; end if;
end $$;

rollback;
