alter table public.attendance
  add column if not exists grade_only boolean not null default false;

create or replace function public.teacher_directory()
returns table(
  teacher_id uuid,
  teacher_name text,
  day text,
  start_time time without time zone,
  end_time time without time zone,
  track text,
  class_number integer,
  group_number integer,
  module text,
  room text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.teacher_directory_impl();
$$;

revoke all on function public.teacher_directory() from public;
revoke all on function public.teacher_directory() from anon;
grant execute on function public.teacher_directory() to authenticated;

notify pgrst, 'reload schema';
