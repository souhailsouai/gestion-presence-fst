-- V5.15 additive planning schema.
-- Stable V5 tables remain authoritative for operational attendance/grades.

alter table public.classes drop constraint if exists classes_group_number_check;
alter table public.classes
  add constraint classes_group_number_check
  check (group_number is null or group_number between 1 and 6);

alter table public.student_groups drop constraint if exists student_groups_group_number_check;
alter table public.student_groups
  add constraint student_groups_group_number_check
  check (group_number is null or group_number between 1 and 6);

create table if not exists public.v515_cycles (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years(id),
  name text not null,
  start_date date not null,
  end_date date not null,
  week_a_anchor_date date not null,
  status text not null default 'DRAFT' check (status in ('DRAFT','OPEN_FOR_REQUESTS','ASSIGNMENT','FINALIZED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  check (start_date <= end_date)
);

create table if not exists public.v515_class_config (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.v515_cycles(id) on delete cascade,
  class_key text not null,
  track text,
  class_number integer,
  display_name text not null,
  group_count integer not null default 4 check (group_count between 1 and 6),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  unique (cycle_id, class_key)
);

create table if not exists public.v515_group_rosters (
  id uuid primary key default gen_random_uuid(),
  class_config_id uuid not null references public.v515_class_config(id) on delete cascade,
  group_no integer not null check (group_no between 1 and 6),
  legacy_class_id uuid not null references public.classes(id),
  student_group_id uuid references public.student_groups(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  unique (class_config_id, group_no),
  unique (class_config_id, legacy_class_id)
);

create table if not exists public.v515_timeslots (
  id uuid primary key default gen_random_uuid(),
  day_of_week smallint check (day_of_week between 1 and 7),
  start_time time not null,
  end_time time not null,
  room text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  check (start_time < end_time)
);

create table if not exists public.v515_fortnight_pairs (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.v515_cycles(id) on delete cascade,
  timeslot_id uuid not null references public.v515_timeslots(id),
  week_a_class_config_id uuid not null references public.v515_class_config(id),
  week_b_class_config_id uuid not null references public.v515_class_config(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  unique (cycle_id, timeslot_id),
  check (week_a_class_config_id <> week_b_class_config_id)
);

create table if not exists public.v515_rotation (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.v515_cycles(id) on delete cascade,
  class_config_id uuid not null references public.v515_class_config(id) on delete cascade,
  pedagogical_session_no smallint not null check (pedagogical_session_no between 1 and 6),
  group_no smallint not null check (group_no between 1 and 6),
  manipulation_code text not null check (manipulation_code in ('M1','M2','M3','M4','M5','M6')),
  created_at timestamptz not null default now(),
  unique (cycle_id, class_config_id, pedagogical_session_no, group_no)
);

create table if not exists public.v515_teacher_config (
  teacher_id uuid primary key references public.profiles(id) on delete cascade,
  quota integer not null default 0 check (quota >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

create table if not exists public.v515_teacher_manipulations (
  teacher_id uuid not null references public.v515_teacher_config(teacher_id) on delete cascade,
  manipulation_code text not null check (manipulation_code in ('M1','M2','M3','M4','M5','M6')),
  created_at timestamptz not null default now(),
  primary key (teacher_id, manipulation_code)
);

create table if not exists public.v515_session_positions (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.v515_cycles(id) on delete cascade,
  class_config_id uuid not null references public.v515_class_config(id),
  roster_id uuid not null references public.v515_group_rosters(id),
  group_no smallint not null check (group_no between 1 and 6),
  pedagogical_session_no smallint not null check (pedagogical_session_no between 1 and 6),
  manipulation_code text not null check (manipulation_code in ('M1','M2','M3','M4','M5','M6')),
  session_date date not null,
  start_time time not null,
  end_time time not null,
  room text,
  fortnight_week text not null check (fortnight_week in ('A','B','EXCEPTION')),
  status text not null default 'DRAFT' check (status in ('DRAFT','OPEN','ASSIGNED','FINALIZED','REALIZED','CANCELLED')),
  source_position_id uuid references public.v515_session_positions(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  check (start_time < end_time)
);

create table if not exists public.v515_requests (
  id uuid primary key default gen_random_uuid(),
  position_id uuid not null references public.v515_session_positions(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'PENDING' check (status in ('PENDING','ACCEPTED','REJECTED','CANCELLED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references public.profiles(id),
  unique (position_id, teacher_id)
);

create table if not exists public.v515_assignments (
  id uuid primary key default gen_random_uuid(),
  position_id uuid not null unique references public.v515_session_positions(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id),
  request_id uuid unique references public.v515_requests(id),
  assigned_by uuid not null references public.profiles(id),
  assigned_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.v515_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists v515_positions_regular_uidx
  on public.v515_session_positions(cycle_id, class_config_id, pedagogical_session_no, group_no)
  where source_position_id is null;
create unique index if not exists v515_positions_catchup_source_uidx
  on public.v515_session_positions(source_position_id)
  where source_position_id is not null;
create index if not exists v515_positions_cycle_date_idx on public.v515_session_positions(cycle_id, session_date, start_time);
create index if not exists v515_positions_open_idx on public.v515_session_positions(status, manipulation_code, session_date, start_time);
create index if not exists v515_requests_teacher_status_idx on public.v515_requests(teacher_id, status, created_at);
create index if not exists v515_assignments_teacher_idx on public.v515_assignments(teacher_id, assigned_at);
create index if not exists v515_audit_entity_idx on public.v515_audit_log(entity_type, entity_id, created_at);

alter table public.sessions add column if not exists v515_position_id uuid;
alter table public.sessions add column if not exists manipulation_code text;
alter table public.sessions add column if not exists room text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname='sessions_v515_position_id_fkey' and conrelid='public.sessions'::regclass
  ) then
    alter table public.sessions add constraint sessions_v515_position_id_fkey foreign key (v515_position_id) references public.v515_session_positions(id);
  end if;
end $$;

create unique index if not exists sessions_v515_position_uidx on public.sessions(v515_position_id) where v515_position_id is not null;
