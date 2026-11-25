-- V43 — Espaces S2 séparés (demande du 25/11/2026).
-- MPI1 · PC1 devient le premier espace ; chaque nouvel espace a ses propres classes, réglages, manipulations,
-- créneaux, dates exclues, groupes, planning, versions et historique.
-- Rôles : super administrateur (super_admin_owner) = tout ; dans un espace : 'admin' (gère l'espace) ou 'teacher'.
-- Seul le super administrateur nomme ou retire un administrateur d'espace.
-- Les appels existants sans espace continuent de viser MPI1 · PC1.

-- 0. Sauvegarde
create table if not exists backup_20261122_enseignants_s1.v33_s2_settings_v43 as table public.v33_s2_settings;
create table if not exists backup_20261122_enseignants_s1.v33_s2_manipulations_v43 as table public.v33_s2_manipulations;
create table if not exists backup_20261122_enseignants_s1.v33_s2_stations_v43 as table public.v33_s2_stations;
create table if not exists backup_20261122_enseignants_s1.v33_s2_class_slots_v43 as table public.v33_s2_class_slots;
create table if not exists backup_20261122_enseignants_s1.v33_s2_excluded_dates_v43 as table public.v33_s2_excluded_dates;
create table if not exists backup_20261122_enseignants_s1.v33_s2_group_members_v43 as table public.v33_s2_group_members;
create table if not exists backup_20261122_enseignants_s1.v33_s2_sessions_v43 as table public.v33_s2_sessions;
create table if not exists backup_20261122_enseignants_s1.v33_s2_slots_v43 as table public.v33_s2_slots;
create table if not exists backup_20261122_enseignants_s1.v33_s2_versions_v43 as table public.v33_s2_versions;
create table if not exists backup_20261122_enseignants_s1.v33_s2_audit_v43 as table public.v33_s2_audit;

-- 1. Espaces et membres
create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) between 2 and 60),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);
insert into public.spaces(id, name) values ('00000000-0000-4000-8000-000000000001', 'MPI1 · PC1');

create table public.space_members (
  space_id uuid not null references public.spaces(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('admin','teacher')),
  created_at timestamptz not null default now(),
  primary key (space_id, profile_id)
);
insert into public.space_members(space_id, profile_id, role)
select '00000000-0000-4000-8000-000000000001', p.id, case when p.role = 'admin' then 'admin' else 'teacher' end
  from public.profiles p where p.deleted_at is null;

alter table public.spaces enable row level security;
alter table public.space_members enable row level security;

-- 2. Fonctions d'autorisation
create or replace function private.default_space() returns uuid language sql immutable
as $$ select '00000000-0000-4000-8000-000000000001'::uuid $$;

create or replace function private.is_super_admin() returns boolean
language sql stable security definer set search_path to '' as $$
  select exists(select 1 from public.super_admin_owner o join public.profiles p on p.id = o.user_id
                 where o.singleton and o.user_id = (select auth.uid()) and p.role = 'admin' and p.deleted_at is null);
$$;

create or replace function private.space_role(p_space uuid) returns text
language sql stable security definer set search_path to '' as $$
  select m.role from public.space_members m join public.profiles p on p.id = m.profile_id
   where m.space_id = p_space and m.profile_id = (select auth.uid()) and p.deleted_at is null;
$$;

create or replace function private.can_read_space(p_space uuid) returns boolean
language sql stable security definer set search_path to '' as $$
  select private.is_super_admin() or private.is_admin() and p_space = private.default_space() or private.space_role(p_space) is not null;
$$;

create or replace function private.can_admin_space(p_space uuid) returns boolean
language sql stable security definer set search_path to '' as $$
  select private.is_super_admin() or (private.is_admin() and p_space = private.default_space()) or private.space_role(p_space) = 'admin';
$$;

revoke all on function private.is_super_admin(), private.space_role(uuid), private.can_read_space(uuid), private.can_admin_space(uuid) from public, anon;
grant execute on function private.is_super_admin(), private.space_role(uuid), private.can_read_space(uuid), private.can_admin_space(uuid), private.default_space() to authenticated;

create policy spaces_read on public.spaces for select to authenticated using (private.can_read_space(id));
create policy space_members_read on public.space_members for select to authenticated
  using (private.is_super_admin() or profile_id = (select auth.uid()) or private.can_admin_space(space_id));

-- Profils : un administrateur d'espace voit les profils des membres de son espace.
create policy profiles_select_space_admin on public.profiles for select to authenticated using (
  exists (select 1 from public.space_members a join public.space_members b on b.space_id = a.space_id
           where a.profile_id = (select auth.uid()) and a.role = 'admin' and b.profile_id = profiles.id));

-- 3. Colonne space_id sur toutes les tables S2 (les lignes existantes vont à MPI1 · PC1)
do $$ declare t text; begin
  foreach t in array array['v33_s2_settings','v33_s2_manipulations','v33_s2_stations','v33_s2_class_slots','v33_s2_excluded_dates',
                           'v33_s2_group_members','v33_s2_sessions','v33_s2_slots','v33_s2_versions','v33_s2_audit'] loop
    execute format('alter table public.%I add column space_id uuid not null default %L references public.spaces(id) on delete cascade', t, '00000000-0000-4000-8000-000000000001');
    execute format('create index %I on public.%I(space_id)', t || '_space_idx', t);
  end loop;
end $$;
alter table public.classes add column space_id uuid not null default '00000000-0000-4000-8000-000000000001' references public.spaces(id);
create index classes_space_idx on public.classes(space_id);

-- Clés par espace
alter table public.v33_s2_settings drop constraint v33_s2_settings_id_check;
alter table public.v33_s2_settings drop constraint v33_s2_settings_pkey;
alter table public.v33_s2_settings alter column id drop not null;
alter table public.v33_s2_settings add primary key (space_id);

alter table public.v33_s2_stations drop constraint v33_s2_stations_manipulation_code_fkey;
alter table public.v33_s2_stations drop constraint v33_s2_stations_pkey;
alter table public.v33_s2_manipulations drop constraint v33_s2_manipulations_pkey;
alter table public.v33_s2_manipulations add primary key (space_id, code);
alter table public.v33_s2_stations add primary key (space_id, weekday, manipulation_code);
alter table public.v33_s2_stations add constraint v33_s2_stations_manip_fkey foreign key (space_id, manipulation_code)
  references public.v33_s2_manipulations(space_id, code) on update cascade;

-- 4. Règles d'accès S2 par espace
do $$ declare t text; begin
  foreach t in array array['v33_s2_settings','v33_s2_manipulations','v33_s2_stations','v33_s2_class_slots','v33_s2_excluded_dates',
                           'v33_s2_group_members','v33_s2_sessions','v33_s2_slots','v33_s2_versions','v33_s2_audit'] loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin', t);
    execute format('create policy %I on public.%I for select to authenticated using (private.can_read_space(space_id))', t || '_read', t);
    execute format('create policy %I on public.%I for all to authenticated using (private.can_admin_space(space_id)) with check (private.can_admin_space(space_id))', t || '_admin', t);
  end loop;
end $$;

-- Classes et étudiants des nouveaux espaces (MPI1 · PC1 et LPC3 gardent leurs règles actuelles)
create policy classes_space_read on public.classes for select to authenticated
  using (deleted_at is null and space_id <> private.default_space() and private.can_read_space(space_id));
create policy classes_space_write on public.classes for all to authenticated
  using (space_id <> private.default_space() and private.mutation_allowed() and private.can_admin_space(space_id))
  with check (space_id <> private.default_space() and private.mutation_allowed() and private.can_admin_space(space_id));
create policy students_space_read on public.students for select to authenticated using (
  deleted_at is null and exists (select 1 from public.classes c where c.id = students.class_id and c.space_id <> private.default_space() and private.can_read_space(c.space_id)));
create policy students_space_write on public.students for all to authenticated
  using (private.mutation_allowed() and exists (select 1 from public.classes c where c.id = students.class_id and c.space_id <> private.default_space() and private.can_admin_space(c.space_id)))
  with check (private.mutation_allowed() and exists (select 1 from public.classes c where c.id = students.class_id and c.space_id <> private.default_space() and private.can_admin_space(c.space_id)));
-- L'ancienne règle « lecture de toutes les classes » ne doit plus montrer les classes des autres espaces.
drop policy classes_select_authenticated on public.classes;
create policy classes_select_authenticated on public.classes for select to authenticated using (
  deleted_at is null and space_id = private.default_space()
  and ((module <> 'TP Ondes et Vibrations') or (teacher_id = (select auth.uid()))));

-- 5. Gestion des espaces
create or replace function public.v43_create_space(p_name text) returns uuid
language plpgsql security definer set search_path to '' as $$
declare v_id uuid; i int;
begin
  if not private.is_super_admin() then raise exception 'Réservé au super administrateur'; end if;
  insert into public.spaces(name, created_by) values (btrim(p_name), auth.uid()) returning id into v_id;
  insert into public.v33_s2_settings(space_id, academic_year, start_date, end_date, group_count, manip_count, status)
    select v_id, academic_year, start_date, end_date, 5, 5, 'brouillon' from public.v33_s2_settings where space_id = private.default_space();
  for i in 1..5 loop insert into public.v33_s2_manipulations(space_id, code, active) values (v_id, 'M' || i, true); end loop;
  insert into public.space_members(space_id, profile_id, role) values (v_id, auth.uid(), 'admin');
  insert into public.v33_s2_audit(space_id, action, detail) values (v_id, 'create_space', jsonb_build_object('name', btrim(p_name)));
  return v_id;
end $$;

create or replace function public.v43_rename_space(p_space uuid, p_name text) returns void
language plpgsql security definer set search_path to '' as $$
begin
  if not private.is_super_admin() then raise exception 'Réservé au super administrateur'; end if;
  update public.spaces set name = btrim(p_name) where id = p_space;
end $$;

create or replace function public.v43_delete_space(p_space uuid) returns void
language plpgsql security definer set search_path to '' as $$
begin
  if not private.is_super_admin() then raise exception 'Réservé au super administrateur'; end if;
  if p_space = private.default_space() then raise exception 'L''espace MPI1 · PC1 ne peut pas être supprimé'; end if;
  if exists (select 1 from public.classes c where c.space_id = p_space and c.deleted_at is null) then
    raise exception 'Supprimez d''abord les classes de cet espace';
  end if;
  delete from public.spaces where id = p_space;
end $$;

-- Ajouter, changer de rôle ou retirer un membre (p_role null = retirer).
-- Le super administrateur gère tout ; un administrateur d'espace ne gère que les enseignants de son espace.
create or replace function public.v43_set_member(p_space uuid, p_profile uuid, p_role text) returns void
language plpgsql security definer set search_path to '' as $$
declare v_old text;
begin
  if p_role is not null and p_role not in ('admin','teacher') then raise exception 'Rôle inconnu'; end if;
  select role into v_old from public.space_members where space_id = p_space and profile_id = p_profile;
  if not private.is_super_admin() then
    if not private.can_admin_space(p_space) then raise exception 'Réservé à l''administrateur de l''espace'; end if;
    if p_role = 'admin' or v_old = 'admin' then raise exception 'Seul le super administrateur nomme ou retire un administrateur'; end if;
  end if;
  if p_role is null then delete from public.space_members where space_id = p_space and profile_id = p_profile;
  else insert into public.space_members(space_id, profile_id, role) values (p_space, p_profile, p_role)
       on conflict (space_id, profile_id) do update set role = excluded.role;
  end if;
  insert into public.v33_s2_audit(space_id, action, detail)
    values (p_space, 'set_member', jsonb_build_object('profile', p_profile, 'role', p_role, 'before', v_old));
end $$;

-- Liste des enseignants (nom) pour choisir un membre : réservé aux administrateurs.
create or replace function public.v43_teacher_directory() returns table(id uuid, full_name text)
language sql stable security definer set search_path to '' as $$
  select p.id, p.full_name from public.profiles p
   where p.deleted_at is null and (private.is_super_admin() or exists (select 1 from public.space_members m where m.profile_id = (select auth.uid()) and m.role = 'admin'))
   order by p.full_name;
$$;

revoke all on function public.v43_create_space(text), public.v43_rename_space(uuid,text), public.v43_delete_space(uuid),
  public.v43_set_member(uuid,uuid,text), public.v43_teacher_directory() from public, anon;
grant execute on function public.v43_create_space(text), public.v43_rename_space(uuid,text), public.v43_delete_space(uuid),
  public.v43_set_member(uuid,uuid,text), public.v43_teacher_directory() to authenticated;
