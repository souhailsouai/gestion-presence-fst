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
security definer
set search_path = ''
as $$
  select
    p.id as teacher_id,
    p.full_name as teacher_name,
    c.day,
    c.start_time,
    c.end_time,
    c.track,
    c.class_number,
    c.group_number,
    c.module,
    c.room
  from public.profiles p
  left join public.classes c
    on c.teacher_id = p.id
   and c.deleted_at is null
  where auth.uid() is not null
    and p.role in ('teacher','admin')
    and p.deleted_at is null
  order by p.full_name, c.day nulls last, c.start_time nulls last;
$$;

revoke all on function public.teacher_directory() from public;
revoke all on function public.teacher_directory() from anon;
grant execute on function public.teacher_directory() to authenticated;

notify pgrst, 'reload schema';
