-- V33 : Semestre 2 — données indépendantes du S1 (tables additives, aucune table S1 modifiée).
-- Règles : aucune séance S2 avant le 11/01/2027 (contrainte), écriture réservée à l'administrateur,
-- lecture pour les comptes connectés, historique dans v33_s2_audit.

create table if not exists public.v33_s2_settings (
  id smallint primary key default 1 check (id = 1),
  academic_year text not null default '2026/2027',
  start_date date not null default '2027-01-11' check (start_date >= '2027-01-11'),
  end_date date check (end_date is null or end_date > start_date),
  group_count int not null default 6 check (group_count between 1 and 12),
  manip_count int not null default 6 check (manip_count between 1 and 9),
  status text not null default 'brouillon' check (status in ('brouillon','publie')),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table if not exists public.v33_s2_manipulations (
  code text primary key check (code ~ '^M[1-9]$'),
  title text check (title is null or length(title) <= 120),
  room text check (room is null or length(room) <= 40),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.v33_s2_class_slots (
  class_name text primary key,
  weekday int not null check (weekday between 1 and 6),
  start_time time not null,
  end_time time not null check (end_time > start_time),
  pair_key text not null,
  pair_order int not null default 1,
  mode text not null default 'alternance' check (mode in ('alternance','bloc')),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.v33_s2_stations (
  weekday int not null check (weekday between 1 and 6),
  manipulation_code text not null references public.v33_s2_manipulations(code) on update cascade,
  teacher_id uuid references public.profiles(id) on delete set null,
  room text check (room is null or length(room) <= 40),
  updated_at timestamptz not null default now(),
  primary key (weekday, manipulation_code)
);

create table if not exists public.v33_s2_group_members (
  student_id uuid primary key references public.students(id) on delete cascade,
  class_name text not null,
  group_no int not null check (group_no between 1 and 12),
  s1_class_id uuid,
  status text not null default 'actif' check (status in ('actif','exclu')),
  reason text check (reason is null or length(reason) <= 200),
  locked boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table if not exists public.v33_s2_excluded_dates (
  id uuid primary key default gen_random_uuid(),
  starts_on date not null,
  ends_on date not null,
  label text not null check (length(label) between 1 and 160),
  kind text not null default 'autre' check (kind in ('ferie','vacances','ds','examen','autre')),
  source text not null default 'manuel' check (source in ('manuel','calendrier')),
  validated boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create table if not exists public.v33_s2_sessions (
  id uuid primary key default gen_random_uuid(),
  class_name text not null,
  session_date date not null check (session_date >= '2027-01-11'),
  start_time time not null,
  end_time time not null check (end_time > start_time),
  occurrence int not null check (occurrence >= 1),
  locked boolean not null default false,
  note text check (note is null or length(note) <= 300),
  created_at timestamptz not null default now(),
  unique (class_name, session_date)
);

create table if not exists public.v33_s2_slots (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.v33_s2_sessions(id) on delete cascade,
  group_no int not null check (group_no between 1 and 12),
  manipulation_code text not null,
  teacher_id uuid references public.profiles(id) on delete set null,
  room text,
  locked boolean not null default false,
  unique (session_id, group_no)
);

create table if not exists public.v33_s2_versions (
  id uuid primary key default gen_random_uuid(),
  label text not null check (length(label) between 1 and 120),
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  created_by uuid
);

create table if not exists public.v33_s2_audit (
  id bigint generated always as identity primary key,
  action text not null,
  detail jsonb,
  actor uuid default auth.uid(),
  created_at timestamptz not null default now()
);

-- RLS : lecture pour les comptes connectés, écriture administrateur.
do $$
declare t text;
begin
  foreach t in array array['v33_s2_settings','v33_s2_manipulations','v33_s2_class_slots','v33_s2_stations',
    'v33_s2_group_members','v33_s2_excluded_dates','v33_s2_sessions','v33_s2_slots','v33_s2_versions','v33_s2_audit'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (true)', t||'_read', t);
    execute format('drop policy if exists %I on public.%I', t||'_admin', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.current_user_is_admin()) with check (public.current_user_is_admin())', t||'_admin', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- Remplacement atomique du planning à partir d'une date (recalcul ciblé) :
-- les séances verrouillées et celles antérieures à p_from sont conservées.
create or replace function public.v33_s2_replace_plan(p_from date, p_sessions jsonb, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_deleted int; v_inserted int := 0; s jsonb; g jsonb; v_id uuid;
begin
  if not public.current_user_is_admin() then raise exception 'Réservé à l''administrateur'; end if;
  if p_from is null or p_from < '2027-01-11' then p_from := '2027-01-11'; end if;
  delete from public.v33_s2_sessions where session_date >= p_from and not locked;
  get diagnostics v_deleted = row_count;
  for s in select * from jsonb_array_elements(coalesce(p_sessions,'[]'::jsonb)) loop
    if (s->>'session_date')::date < p_from then continue; end if;
    if exists (select 1 from public.v33_s2_sessions x where x.class_name = s->>'class_name' and x.session_date = (s->>'session_date')::date) then continue; end if;
    insert into public.v33_s2_sessions(class_name, session_date, start_time, end_time, occurrence, note)
      values (s->>'class_name', (s->>'session_date')::date, (s->>'start_time')::time, (s->>'end_time')::time, (s->>'occurrence')::int, s->>'note')
      returning id into v_id;
    for g in select * from jsonb_array_elements(coalesce(s->'slots','[]'::jsonb)) loop
      insert into public.v33_s2_slots(session_id, group_no, manipulation_code, teacher_id, room)
        values (v_id, (g->>'group_no')::int, g->>'manipulation_code', nullif(g->>'teacher_id','')::uuid, g->>'room');
    end loop;
    v_inserted := v_inserted + 1;
  end loop;
  insert into public.v33_s2_audit(action, detail) values ('replace_plan', jsonb_build_object('from', p_from, 'deleted', v_deleted, 'inserted', v_inserted, 'reason', p_reason));
  return jsonb_build_object('deleted', v_deleted, 'inserted', v_inserted);
end $$;

create or replace function public.v33_s2_save_version(p_label text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not public.current_user_is_admin() then raise exception 'Réservé à l''administrateur'; end if;
  insert into public.v33_s2_versions(label, snapshot, created_by)
  select p_label, jsonb_build_object(
    'sessions', coalesce((select jsonb_agg(to_jsonb(s) order by s.session_date, s.class_name) from public.v33_s2_sessions s), '[]'::jsonb),
    'slots', coalesce((select jsonb_agg(to_jsonb(g)) from public.v33_s2_slots g), '[]'::jsonb)), auth.uid()
  returning id into v_id;
  insert into public.v33_s2_audit(action, detail) values ('save_version', jsonb_build_object('id', v_id, 'label', p_label));
  return v_id;
end $$;

create or replace function public.v33_s2_restore_version(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v jsonb; n int;
begin
  if not public.current_user_is_admin() then raise exception 'Réservé à l''administrateur'; end if;
  select snapshot into v from public.v33_s2_versions where id = p_id;
  if v is null then raise exception 'Version introuvable'; end if;
  delete from public.v33_s2_sessions;
  insert into public.v33_s2_sessions select * from jsonb_populate_recordset(null::public.v33_s2_sessions, v->'sessions');
  get diagnostics n = row_count;
  insert into public.v33_s2_slots select * from jsonb_populate_recordset(null::public.v33_s2_slots, v->'slots');
  insert into public.v33_s2_audit(action, detail) values ('restore_version', jsonb_build_object('id', p_id, 'sessions', n));
  return jsonb_build_object('sessions', n);
end $$;

revoke all on function public.v33_s2_replace_plan(date, jsonb, text) from public, anon;
revoke all on function public.v33_s2_save_version(text) from public, anon;
revoke all on function public.v33_s2_restore_version(uuid) from public, anon;
grant execute on function public.v33_s2_replace_plan(date, jsonb, text) to authenticated;
grant execute on function public.v33_s2_save_version(text) to authenticated;
grant execute on function public.v33_s2_restore_version(uuid) to authenticated;

-- Valeurs de départ (modifiables dans l'application).
insert into public.v33_s2_settings(id) values (1) on conflict do nothing;
insert into public.v33_s2_manipulations(code, room)
select m.code, r.room from public.v515_manipulations m left join public.v515_manipulation_rooms r on r.manipulation_code = m.code
on conflict do nothing;
insert into public.v33_s2_class_slots(class_name, weekday, start_time, end_time, pair_key, pair_order, mode) values
 ('MPI1-A',1,'14:00','17:00','lundi',1,'alternance'), ('MPI1-E',1,'14:00','17:00','lundi',2,'alternance'),
 ('MPI1-C',4,'14:00','17:00','jeudi',1,'alternance'), ('MPI1-D',4,'14:00','17:00','jeudi',2,'alternance'),
 ('MPI1-B',5,'14:00','17:00','vendredi',1,'bloc'),     ('PC1-A',5,'14:00','17:00','vendredi',2,'bloc')
on conflict do nothing;
