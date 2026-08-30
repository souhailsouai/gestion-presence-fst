alter table public.attendance
  add column if not exists grade_only boolean not null default false;

create or replace function public.enforce_completed_session_attendance_edits()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session_id uuid;
  v_completed_at timestamptz;
  v_teacher_id uuid;
  v_is_admin boolean := false;
begin
  if auth.uid() is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  v_session_id := case when tg_op = 'DELETE' then old.session_id else new.session_id end;
  select s.completed_at, s.teacher_id
    into v_completed_at, v_teacher_id
  from public.sessions s
  where s.id = v_session_id;

  if v_completed_at is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  select exists(
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) into v_is_admin;

  if v_is_admin then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if v_teacher_id is distinct from auth.uid() then
    raise exception 'session read only';
  end if;

  if tg_op = 'DELETE' then
    raise exception 'completed session: attendance cannot be deleted';
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status
       or coalesce(new.comment,'') is distinct from coalesce(old.comment,'')
       or new.student_id is distinct from old.student_id
       or new.session_id is distinct from old.session_id
       or new.teacher_id is distinct from old.teacher_id
       or new.grade_only is distinct from old.grade_only
    then
      raise exception 'completed session: only grade can be modified';
    end if;
  elsif tg_op = 'INSERT' then
    if not coalesce(new.grade_only,false)
       or new.grade is null
       or new.status is distinct from 'present'
       or coalesce(new.comment,'') <> ''
    then
      raise exception 'completed session: only a grade-only entry can be added';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists attendance_completed_session_guard on public.attendance;
create trigger attendance_completed_session_guard
before insert or update or delete on public.attendance
for each row execute function public.enforce_completed_session_attendance_edits();
