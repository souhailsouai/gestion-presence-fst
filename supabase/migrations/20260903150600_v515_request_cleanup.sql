begin;

create or replace function private.v515_reject_competing_requests()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
  update public.v515_requests
  set status='rejected',updated_at=now()
  where session_id=new.session_id
    and group_no=new.group_no
    and status='pending'
    and (new.request_id is null or id<>new.request_id);
  return new;
end;
$$;

revoke execute on function private.v515_reject_competing_requests() from public,anon;

drop trigger if exists v515_reject_competing_requests_after_assignment on public.v515_assignments;
create trigger v515_reject_competing_requests_after_assignment
after insert on public.v515_assignments
for each row execute function private.v515_reject_competing_requests();

commit;
