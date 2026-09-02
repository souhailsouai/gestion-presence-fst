\set ON_ERROR_STOP on
create extension if not exists pgcrypto;

do $$ begin create role anon noinherit; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated noinherit; exception when duplicate_object then null; end $$;

create schema if not exists auth;
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid;
$$;
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;

create table public.profiles (
  id uuid primary key,
  full_name text not null default '',
  role text not null default 'teacher',
  email text,
  username text,
  account_state text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.academic_years (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  starts_on date,
  ends_on date,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id),
  name text not null,
  module text not null default 'TP Physique',
  day text,
  start_time time,
  end_time time,
  room text,
  track text,
  class_number integer,
  group_number integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  updated_by uuid references public.profiles(id),
  constraint classes_group_number_check check (group_number is null or group_number between 1 and 4)
);

create table public.student_groups (
  id uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years(id),
  track text,
  class_number integer,
  group_number integer,
  display_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  updated_by uuid references public.profiles(id),
  constraint student_groups_group_number_check check (group_number is null or group_number between 1 and 4)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id),
  class_id uuid not null references public.classes(id),
  last_name text not null,
  first_name text not null,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  updated_by uuid references public.profiles(id)
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id),
  class_id uuid not null references public.classes(id),
  session_date date not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  deleted_at timestamptz,
  updated_by uuid references public.profiles(id)
);

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists(
    select 1 from public.profiles p
    where p.id=auth.uid() and p.role='admin' and p.deleted_at is null
  );
$$;

insert into public.profiles(id,full_name,role,email,account_state) values
('00000000-0000-0000-0000-000000000001','V515 CI Admin','admin','admin@example.test','active'),
('00000000-0000-0000-0000-000000000002','V515 CI Teacher','teacher','teacher@example.test','active');
insert into public.academic_years(id,code,starts_on,ends_on,is_active)
values('10000000-0000-0000-0000-000000000001','2026/2027',date '2026-09-01',date '2027-06-30',true);
