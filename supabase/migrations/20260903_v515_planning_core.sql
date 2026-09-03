begin;

create table if not exists public.v515_cycles (
  id uuid primary key default gen_random_uuid(),
  academic_year text not null,
  semester integer not null check (semester between 1 and 3),
  status text not null default 'draft' check (status in ('draft','published','assignments_finalized','cycle_closed')),
  group_count integer not null default 4 check (group_count between 1 and 6),
  manipulation_count integer not null default 6 check (manipulation_count = 6),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academic_year, semester)
);

create table if not exists public.v515_class_pairs (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.v515_cycles(id) on delete cascade,
  weekday text not null check (weekday in ('monday','thursday','friday')),
  start_time time not null,
  end_time time not null,
  class_a text not null,
  class_b text not null,
  first_class text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (end_time > start_time),
  check (first_class = class_a or first_class = class_b),
  unique (cycle_id, weekday, start_time, end_time)
);

create table if not exists public.v515_groups (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.v515_cycles(id) on delete cascade,
  class_name text not null,
  group_no integer not null check (group_no between 1 and 6),
  active boolean not null default true,
  unique (cycle_id, class_name, group_no)
);

create table if not exists public.v515_manipulations (
  code text primary key check (code in ('M1','M2','M3','M4','M5','M6')),
  title text,
  active boolean not null default true
);

insert into public.v515_manipulations(code) values
  ('M1'),('M2'),('M3'),('M4'),('M5'),('M6')
on conflict (code) do nothing;

create table if not exists public.v515_sessions (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.v515_cycles(id) on delete cascade,
  pair_id uuid references public.v515_class_pairs(id) on delete restrict,
  session_date date not null,
  start_time time not null,
  end_time time not null,
  class_name text,
  is_teaching_session boolean not null default true,
  non_teaching_reason text,
  effective_session_index integer,
  class_occurrence integer,
  lifecycle_status text not null default 'draft' check (lifecycle_status in ('draft','published','assignments_finalized','completed','cancelled')),
  completed_at timestamptz,
  legacy_session_id uuid references public.sessions(id) on delete restrict,
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time),
  check ((is_teaching_session and class_name is not null and effective_session_index is not null and class_occurrence is not null)
      or (not is_teaching_session and class_name is null and effective_session_index is null and class_occurrence is null)),
  unique (cycle_id, session_date, start_time, end_time)
);

create table if not exists public.v515_teacher_constraints (
  cycle_id uuid not null references public.v515_cycles(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  quota integer not null default 0 check (quota >= 0),
  allowed_manipulations text[] not null default array[]::text[],
  updated_at timestamptz not null default now(),
  primary key (cycle_id, teacher_id),
  check (allowed_manipulations <@ array['M1','M2','M3','M4','M5','M6']::text[])
);

create table if not exists public.v515_requests (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.v515_cycles(id) on delete cascade,
  session_id uuid not null references public.v515_sessions(id) on delete cascade,
  group_no integer not null check (group_no between 1 and 6),
  manipulation_code text not null references public.v515_manipulations(code),
  teacher_id uuid not null default auth.uid() references public.profiles(id),
  status text not null default 'pending' check (status in ('pending','validated','rejected','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists v515_requests_one_pending_per_teacher_post
on public.v515_requests(session_id, group_no, manipulation_code, teacher_id)
where status = 'pending';

create table if not exists public.v515_assignments (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.v515_cycles(id) on delete cascade,
  session_id uuid not null references public.v515_sessions(id) on delete cascade,
  group_no integer not null check (group_no between 1 and 6),
  manipulation_code text not null references public.v515_manipulations(code),
  teacher_id uuid not null references public.profiles(id),
  source text not null check (source in ('request_validation','admin_direct')),
  request_id uuid references public.v515_requests(id) on delete set null,
  assigned_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (session_id, group_no),
  unique (session_id, manipulation_code)
);

create table if not exists public.v515_waivers (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.v515_cycles(id) on delete cascade,
  class_name text not null,
  group_no integer not null check (group_no between 1 and 6),
  manipulation_code text not null references public.v515_manipulations(code),
  reason text not null,
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (cycle_id, class_name, group_no, manipulation_code)
);

create table if not exists public.v515_audit_log (
  id bigint generated always as identity primary key,
  cycle_id uuid references public.v515_cycles(id) on delete set null,
  actor_id uuid default auth.uid() references public.profiles(id),
  event_type text not null,
  error_code text,
  message text not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists v515_sessions_cycle_date_idx on public.v515_sessions(cycle_id, session_date, start_time);
create index if not exists v515_requests_teacher_idx on public.v515_requests(teacher_id, status);
create index if not exists v515_assignments_teacher_idx on public.v515_assignments(teacher_id, cycle_id);

alter table public.v515_cycles enable row level security;
alter table public.v515_class_pairs enable row level security;
alter table public.v515_groups enable row level security;
alter table public.v515_manipulations enable row level security;
alter table public.v515_sessions enable row level security;
alter table public.v515_teacher_constraints enable row level security;
alter table public.v515_requests enable row level security;
alter table public.v515_assignments enable row level security;
alter table public.v515_waivers enable row level security;
alter table public.v515_audit_log enable row level security;

grant select on public.v515_cycles, public.v515_class_pairs, public.v515_groups, public.v515_manipulations, public.v515_sessions to authenticated;
grant select on public.v515_teacher_constraints, public.v515_requests, public.v515_assignments to authenticated;
revoke all on public.v515_waivers, public.v515_audit_log from anon;

create policy v515_cycles_read on public.v515_cycles for select to authenticated using ((select auth.uid()) is not null);
create policy v515_cycles_admin_all on public.v515_cycles for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy v515_pairs_read on public.v515_class_pairs for select to authenticated using ((select auth.uid()) is not null);
create policy v515_pairs_admin_all on public.v515_class_pairs for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy v515_groups_read on public.v515_groups for select to authenticated using ((select auth.uid()) is not null);
create policy v515_groups_admin_all on public.v515_groups for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy v515_manipulations_read on public.v515_manipulations for select to authenticated using ((select auth.uid()) is not null);
create policy v515_manipulations_admin_all on public.v515_manipulations for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy v515_sessions_read on public.v515_sessions for select to authenticated using ((select auth.uid()) is not null);
create policy v515_sessions_admin_all on public.v515_sessions for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create policy v515_constraints_read on public.v515_teacher_constraints for select to authenticated
using (teacher_id = (select auth.uid()) or (select private.is_admin()));
create policy v515_constraints_admin_all on public.v515_teacher_constraints for all to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

create policy v515_requests_read on public.v515_requests for select to authenticated
using (teacher_id = (select auth.uid()) or (select private.is_admin()));
create policy v515_requests_insert_own on public.v515_requests for insert to authenticated
with check (teacher_id = (select auth.uid()));
create policy v515_requests_update_own_pending on public.v515_requests for update to authenticated
using (teacher_id = (select auth.uid()) and status = 'pending')
with check (teacher_id = (select auth.uid()) and status in ('pending','cancelled'));
create policy v515_requests_admin_all on public.v515_requests for all to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

create policy v515_assignments_read on public.v515_assignments for select to authenticated
using (teacher_id = (select auth.uid()) or (select private.is_admin()));
create policy v515_assignments_admin_all on public.v515_assignments for all to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));

create policy v515_waivers_admin_all on public.v515_waivers for all to authenticated
using ((select private.is_admin())) with check ((select private.is_admin()));
create policy v515_audit_admin_read on public.v515_audit_log for select to authenticated using ((select private.is_admin()));
create policy v515_audit_admin_insert on public.v515_audit_log for insert to authenticated with check ((select private.is_admin()));

commit;
