alter table public.attendance drop constraint if exists attendance_status_check;
alter table public.attendance add constraint attendance_status_check check (status = any (array['present'::text,'absent'::text,'retard'::text,'justifie'::text,'non_saisi'::text]));

create or replace function public.enforce_completed_attendance_changes()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session_id uuid;
  v_completed_at timestamptz;
  v_is_admin boolean;
begin
  v_session_id := case when tg_op = 'DELETE' then old.session_id else new.session_id end;
  select s.completed_at into v_completed_at from public.sessions s where s.id = v_session_id;
  if v_completed_at is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  select exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') into v_is_admin;
  if v_is_admin then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'completed_session_attendance_locked';
  elsif tg_op = 'INSERT' then
    if new.teacher_id is distinct from auth.uid()
       or new.status <> 'non_saisi'
       or coalesce(new.comment,'') <> ''
       or new.grade is null then
      raise exception 'completed_session_grade_only';
    end if;
    return new;
  else
    if new.id is distinct from old.id
       or new.teacher_id is distinct from old.teacher_id
       or new.session_id is distinct from old.session_id
       or new.student_id is distinct from old.student_id
       or new.status is distinct from old.status
       or new.comment is distinct from old.comment
       or new.recorded_at is distinct from old.recorded_at then
      raise exception 'completed_session_grade_only';
    end if;
    return new;
  end if;
end;
$$;

drop trigger if exists attendance_completed_session_guard on public.attendance;
create trigger attendance_completed_session_guard
before insert or update or delete on public.attendance
for each row execute function public.enforce_completed_attendance_changes();

create or replace function public.enforce_completed_session_immutability()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_is_admin boolean;
begin
  if old.completed_at is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  select exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') into v_is_admin;
  if v_is_admin then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  raise exception 'completed_session_locked';
end;
$$;

drop trigger if exists session_completed_guard on public.sessions;
create trigger session_completed_guard
before update or delete on public.sessions
for each row execute function public.enforce_completed_session_immutability();
