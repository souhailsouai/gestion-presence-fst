begin;

create table public.v16_test_sessions (
  id uuid primary key default gen_random_uuid(),
  context text not null default 'test' check(context='test'),
  real_session_id uuid references public.v515_sessions(id) on delete set null,
  session_date date not null,
  start_time time not null,
  end_time time not null,
  class_name text,
  lifecycle_status text not null default 'draft',
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(end_time>start_time)
);

create table public.v16_test_assignments (
  id uuid primary key default gen_random_uuid(),
  context text not null default 'test' check(context='test'),
  test_session_id uuid not null references public.v16_test_sessions(id) on delete cascade,
  real_assignment_id uuid references public.v515_assignments(id) on delete set null,
  group_no integer not null check(group_no between 1 and 4),
  manipulation_code text not null check(manipulation_code in ('M1','M2','M3','M4','M5','M6')),
  teacher_id uuid not null references public.profiles(id),
  room text not null check(room in ('A','B','C','D')),
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(test_session_id,group_no),
  unique(test_session_id,manipulation_code)
);

create table public.v16_test_attendance (
  id uuid primary key default gen_random_uuid(),
  context text not null default 'test' check(context='test'),
  test_session_id uuid not null references public.v16_test_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status text not null default 'present',
  comment text,
  grade numeric,
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(test_session_id,student_id)
);

create table public.v16_test_scenarios (
  id uuid primary key default gen_random_uuid(),
  context text not null default 'test' check(context='test'),
  name text not null,
  description text,
  effective_date date,
  state jsonb not null default '{}'::jsonb,
  created_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.v16_test_sessions enable row level security;
alter table public.v16_test_assignments enable row level security;
alter table public.v16_test_attendance enable row level security;
alter table public.v16_test_scenarios enable row level security;

grant select,insert,update,delete on public.v16_test_sessions to authenticated;
grant select,insert,update,delete on public.v16_test_assignments to authenticated;
grant select,insert,update,delete on public.v16_test_attendance to authenticated;
grant select,insert,update,delete on public.v16_test_scenarios to authenticated;

create policy v16_test_sessions_admin on public.v16_test_sessions
for all to authenticated using((select private.is_admin())) with check((select private.is_admin()));
create policy v16_test_assignments_admin on public.v16_test_assignments
for all to authenticated using((select private.is_admin())) with check((select private.is_admin()));
create policy v16_test_attendance_admin on public.v16_test_attendance
for all to authenticated using((select private.is_admin())) with check((select private.is_admin()));
create policy v16_test_scenarios_admin on public.v16_test_scenarios
for all to authenticated using((select private.is_admin())) with check((select private.is_admin()));

create or replace function public.v16_reset_test_context()
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_sessions integer:=0;
  v_assignments integer:=0;
  v_attendance integer:=0;
  v_scenarios integer:=0;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not(select private.is_admin()) then
    return jsonb_build_object('ok',false,'code','FORBIDDEN','message','Accès Admin requis.');
  end if;

  select count(*) into v_attendance from public.v16_test_attendance;
  select count(*) into v_assignments from public.v16_test_assignments;
  select count(*) into v_sessions from public.v16_test_sessions;
  select count(*) into v_scenarios from public.v16_test_scenarios;

  delete from public.v16_test_attendance;
  delete from public.v16_test_assignments;
  delete from public.v16_test_sessions;
  delete from public.v16_test_scenarios;

  perform private.v515_audit(
    null,
    'v16_test_context_reset',
    null,
    'Contexte TEST V16 réinitialisé.',
    jsonb_build_object(
      'test_sessions_deleted',v_sessions,
      'test_assignments_deleted',v_assignments,
      'test_attendance_deleted',v_attendance,
      'test_scenarios_deleted',v_scenarios
    )
  );

  return jsonb_build_object(
    'ok',true,
    'deleted',jsonb_build_object(
      'sessions',v_sessions,
      'assignments',v_assignments,
      'attendance',v_attendance,
      'scenarios',v_scenarios
    )
  );
end;
$$;

revoke execute on function public.v16_reset_test_context() from public,anon;
grant execute on function public.v16_reset_test_context() to authenticated;

commit;
