-- Web V5 planning layer. Additive only: real attendance remains in sessions/attendance.

create table if not exists public.session_plans (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years(id),
  class_id uuid not null references public.classes(id),
  teacher_id uuid null references public.profiles(id),
  plan_date date not null,
  start_time time without time zone not null,
  end_time time without time zone not null,
  module text not null default 'TP Physique' check (module = 'TP Physique'),
  manipulation text null check (manipulation in ('M1','M2','M3','M4','M5','M6') or manipulation is null),
  status text not null default 'undefined' check (status in ('planned','pause','undefined')),
  session_id uuid null unique references public.sessions(id),
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid null references public.profiles(id),
  deleted_at timestamptz null,
  unique (class_id, plan_date),
  check (end_time > start_time)
);

create index if not exists session_plans_date_idx on public.session_plans(plan_date) where deleted_at is null;
create index if not exists session_plans_teacher_date_idx on public.session_plans(teacher_id, plan_date) where deleted_at is null;

create or replace function public.current_user_is_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and p.deleted_at is null);
$$;
revoke all on function public.current_user_is_admin() from public;
grant execute on function public.current_user_is_admin() to authenticated;

alter table public.session_plans enable row level security;
drop policy if exists session_plans_select_authenticated on public.session_plans;
create policy session_plans_select_authenticated on public.session_plans for select to authenticated using (deleted_at is null);
drop policy if exists session_plans_admin_insert on public.session_plans;
create policy session_plans_admin_insert on public.session_plans for insert to authenticated with check (private.mutation_allowed() and public.current_user_is_admin());
drop policy if exists session_plans_admin_update on public.session_plans;
create policy session_plans_admin_update on public.session_plans for update to authenticated using (private.mutation_allowed() and public.current_user_is_admin()) with check (private.mutation_allowed() and public.current_user_is_admin());
drop policy if exists session_plans_admin_delete on public.session_plans;
create policy session_plans_admin_delete on public.session_plans for delete to authenticated using (private.mutation_allowed() and public.current_user_is_admin());

-- All authenticated teachers can read the timetable; Admin alone mutates academic structure.
drop policy if exists classes_select_authorized on public.classes;
drop policy if exists classes_select_authenticated on public.classes;
create policy classes_select_authenticated on public.classes for select to authenticated using (deleted_at is null);
drop policy if exists classes_insert_authorized on public.classes;
create policy classes_insert_authorized on public.classes for insert to authenticated with check (private.mutation_allowed() and public.current_user_is_admin());
drop policy if exists classes_update_authorized on public.classes;
create policy classes_update_authorized on public.classes for update to authenticated using (private.mutation_allowed() and public.current_user_is_admin()) with check (private.mutation_allowed() and public.current_user_is_admin());
drop policy if exists classes_delete_authorized on public.classes;
create policy classes_delete_authorized on public.classes for delete to authenticated using (private.mutation_allowed() and public.current_user_is_admin());

-- Teachers can read rosters only for groups assigned to them through a plan or real session.
drop policy if exists students_select_authorized on public.students;
create policy students_select_authorized on public.students for select to authenticated using (
  deleted_at is null and (
    public.current_user_is_admin()
    or exists(select 1 from public.session_plans sp where sp.class_id=students.class_id and sp.teacher_id=auth.uid() and sp.deleted_at is null)
    or exists(select 1 from public.sessions se where se.class_id=students.class_id and se.teacher_id=auth.uid() and se.deleted_at is null)
  )
);
drop policy if exists students_insert_authorized on public.students;
create policy students_insert_authorized on public.students for insert to authenticated with check (private.mutation_allowed() and public.current_user_is_admin());
drop policy if exists students_update_authorized on public.students;
create policy students_update_authorized on public.students for update to authenticated using (private.mutation_allowed() and public.current_user_is_admin()) with check (private.mutation_allowed() and public.current_user_is_admin());
drop policy if exists students_delete_authorized on public.students;
create policy students_delete_authorized on public.students for delete to authenticated using (private.mutation_allowed() and public.current_user_is_admin());

-- Teachers start real sessions through the guarded RPC. Direct session creation/deletion is Admin-only.
drop policy if exists sessions_insert_authorized on public.sessions;
create policy sessions_insert_authorized on public.sessions for insert to authenticated with check (private.mutation_allowed() and public.current_user_is_admin());
drop policy if exists sessions_update_authorized on public.sessions;
create policy sessions_update_authorized on public.sessions for update to authenticated using (private.mutation_allowed() and (teacher_id=auth.uid() or public.current_user_is_admin())) with check (private.mutation_allowed() and (teacher_id=auth.uid() or public.current_user_is_admin()));
drop policy if exists sessions_delete_authorized on public.sessions;
create policy sessions_delete_authorized on public.sessions for delete to authenticated using (private.mutation_allowed() and public.current_user_is_admin());

create or replace function public.enforce_v5_session_identity()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or public.current_user_is_admin() then return new; end if;
  if old.teacher_id is distinct from auth.uid() then raise exception 'session read only'; end if;
  if new.teacher_id is distinct from old.teacher_id
     or new.class_id is distinct from old.class_id
     or new.session_date is distinct from old.session_date
     or new.start_time is distinct from old.start_time
     or new.end_time is distinct from old.end_time
     or new.assignment_id is distinct from old.assignment_id
     or new.group_id is distinct from old.group_id
     or new.course_id is distinct from old.course_id
  then raise exception 'assigned teacher can only update session completion metadata'; end if;
  return new;
end;
$$;
drop trigger if exists sessions_v5_identity_guard on public.sessions;
create trigger sessions_v5_identity_guard before update on public.sessions for each row execute function public.enforce_v5_session_identity();

create or replace function public.start_session_plan(p_plan_id uuid)
returns uuid language plpgsql security definer set search_path = public, private, pg_temp
as $$
declare v_plan public.session_plans%rowtype; v_session_id uuid;
begin
  if auth.uid() is null or not private.mutation_allowed() then raise exception 'authentication required'; end if;
  select * into v_plan from public.session_plans where id=p_plan_id and deleted_at is null for update;
  if not found then raise exception 'session plan not found'; end if;
  if v_plan.status <> 'planned' then raise exception 'session plan is not active'; end if;
  if v_plan.teacher_id is null then raise exception 'session plan has no assigned teacher'; end if;
  if v_plan.manipulation is null then raise exception 'session plan has no manipulation'; end if;
  if not public.current_user_is_admin() and v_plan.teacher_id is distinct from auth.uid() then raise exception 'session plan is not assigned to current teacher'; end if;
  if v_plan.session_id is not null then return v_plan.session_id; end if;
  insert into public.sessions(teacher_id,class_id,session_date,start_time,end_time,updated_by)
  values(v_plan.teacher_id,v_plan.class_id,v_plan.plan_date,v_plan.start_time,v_plan.end_time,auth.uid()) returning id into v_session_id;
  update public.session_plans set session_id=v_session_id,revision=revision+1,updated_at=now(),updated_by=auth.uid() where id=v_plan.id;
  return v_session_id;
end;
$$;
revoke all on function public.start_session_plan(uuid) from public;
revoke all on function public.start_session_plan(uuid) from anon;
grant execute on function public.start_session_plan(uuid) to authenticated;

-- Existing attendance.grade_only and completed-session trigger semantics are intentionally preserved.
-- grade_only remains the post-closure grade mechanism.
do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='session_plans') then
    alter publication supabase_realtime add table public.session_plans;
  end if;
end $$;