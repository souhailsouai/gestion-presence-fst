begin;

do $$
begin
  if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='v515_verify_cycle') then
    raise exception 'verify RPC missing';
  end if;
  if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='v515_finalize_cycle') then
    raise exception 'finalize RPC missing';
  end if;
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='sessions' and column_name='v515_position_id') then
    raise exception 'sessions traceability column missing';
  end if;
end $$;

rollback;
