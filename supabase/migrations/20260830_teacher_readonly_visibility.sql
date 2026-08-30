drop policy if exists classes_select_owner_or_admin on public.classes;
drop policy if exists classes_select_authenticated on public.classes;
create policy classes_select_authenticated
on public.classes for select
to authenticated
using (true);

drop policy if exists sessions_select_owner_or_admin on public.sessions;
drop policy if exists sessions_select_authenticated on public.sessions;
create policy sessions_select_authenticated
on public.sessions for select
to authenticated
using (true);

-- The directory exposes only identifiers, display names, and teaching schedule metadata.
-- SECURITY DEFINER is intentional because profiles themselves remain self/admin-only under RLS.
drop function if exists public.teacher_directory();
create function public.teacher_directory()
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
set search_path = public, pg_temp
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
  left join public.classes c on c.teacher_id = p.id
  where auth.uid() is not null
    and p.role in ('teacher','admin')
  order by p.full_name, c.day nulls last, c.start_time nulls last,
           c.track nulls last, c.class_number nulls last, c.group_number nulls last;
$$;

revoke all on function public.teacher_directory() from public;
revoke all on function public.teacher_directory() from anon;
grant execute on function public.teacher_directory() to authenticated;
