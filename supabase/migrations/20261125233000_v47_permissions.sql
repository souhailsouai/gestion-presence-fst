-- V47 — Rôles et accès : le super administrateur choisit, permission par permission et espace par espace,
-- ce que chaque personne peut gérer. Un administrateur d'espace garde tout dans son espace (comme avant).
create table if not exists public.space_permissions(
  space_id uuid not null references public.spaces(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  perm text not null check (perm in ('students.edit','classes.edit','groups.edit',
    'planning.settings','planning.manips','planning.stations','planning.generate','planning.sessions',
    'attendance.any','attendance.edit','attendance.makeup','exports','stats',
    'team.edit','accounts.manage','notices.edit')),
  granted_by uuid references public.profiles(id), granted_at timestamptz not null default now(),
  primary key (space_id, profile_id, perm));
alter table public.space_permissions enable row level security;
drop policy if exists space_permissions_read on public.space_permissions;
create policy space_permissions_read on public.space_permissions for select to authenticated
  using (profile_id = (select auth.uid()) or private.is_super_admin());

create or replace function private.can_do(p_space uuid, p_perm text) returns boolean
language sql stable security definer set search_path to '' as $$
  select coalesce(private.can_admin_space(p_space), false)
      or exists (select 1 from public.space_permissions sp where sp.space_id = p_space and sp.profile_id = (select auth.uid()) and sp.perm = p_perm);
$$;
create or replace function private.can_do_any(p_space uuid, p_perms text[]) returns boolean
language sql stable security definer set search_path to '' as $$
  select coalesce(private.can_admin_space(p_space), false)
      or exists (select 1 from public.space_permissions sp where sp.space_id = p_space and sp.profile_id = (select auth.uid()) and (p_perms is null or sp.perm = any(p_perms)));
$$;
grant execute on function private.can_do(uuid, text), private.can_do_any(uuid, text[]) to authenticated;

-- Règles d'écriture S2 par permission
do $$ declare r record; begin
  for r in select * from (values
    ('v33_s2_settings', array['planning.settings']),
    ('v33_s2_class_slots', array['planning.settings','classes.edit']),
    ('v33_s2_excluded_dates', array['planning.settings']),
    ('v33_s2_manipulations', array['planning.manips']),
    ('v33_s2_stations', array['planning.stations']),
    ('v33_s2_sessions', array['planning.generate','planning.sessions']),
    ('v33_s2_slots', array['planning.generate','planning.sessions']),
    ('v33_s2_versions', array['planning.generate']),
    ('v33_s2_group_members', array['groups.edit','students.edit','classes.edit']),
    ('v33_s2_audit', null::text[])) as x(t, perms) loop
    execute format('drop policy if exists %I on public.%I', r.t||'_admin', r.t);
    execute format('create policy %I on public.%I for all to authenticated using (private.can_do_any(space_id, %L)) with check (private.can_do_any(space_id, %L))', r.t||'_admin', r.t, r.perms, r.perms);
  end loop;
end $$;
drop policy if exists classes_space_write on public.classes;
create policy classes_space_write on public.classes for all to authenticated
  using (space_id <> private.default_space() and private.mutation_allowed() and private.can_do(space_id, 'classes.edit'))
  with check (space_id <> private.default_space() and private.mutation_allowed() and private.can_do(space_id, 'classes.edit'));
drop policy if exists students_space_write on public.students;
create policy students_space_write on public.students for all to authenticated
  using (private.mutation_allowed() and exists (select 1 from public.classes c where c.id = students.class_id and c.space_id <> private.default_space() and private.can_do(c.space_id, 'students.edit')))
  with check (private.mutation_allowed() and exists (select 1 from public.classes c where c.id = students.class_id and c.space_id <> private.default_space() and private.can_do(c.space_id, 'students.edit')));

-- Avis officiels : permission « notices.edit » (donnée sur MPI1 · PC1, les avis étant communs)
drop policy if exists v21_notices_insert_admin on public.v21_notices;
drop policy if exists v21_notices_update_admin on public.v21_notices;
drop policy if exists v21_notices_delete_admin on public.v21_notices;
create policy v21_notices_insert_admin on public.v21_notices for insert to authenticated with check ((select private.is_admin()) or private.can_do(private.default_space(), 'notices.edit'));
create policy v21_notices_update_admin on public.v21_notices for update to authenticated using ((select private.is_admin()) or private.can_do(private.default_space(), 'notices.edit')) with check ((select private.is_admin()) or private.can_do(private.default_space(), 'notices.edit'));
create policy v21_notices_delete_admin on public.v21_notices for delete to authenticated using ((select private.is_admin()) or private.can_do(private.default_space(), 'notices.edit'));

-- Appel, présences, rattrapages : les séances de l'espace (hors LPC3)
create or replace function private.can_access_session(p_session_id uuid) returns boolean
language sql stable security definer set search_path to '' as $function$
  select exists(
    select 1 from public.sessions s join public.classes c on c.id = s.class_id
    where s.id = p_session_id and s.deleted_at is null
      and (
        (c.module = 'TP Ondes et Vibrations' and private.is_lpc3_owner())
        or (c.module is distinct from 'TP Ondes et Vibrations' and (private.is_admin() or s.teacher_id = (select auth.uid())))
        or (c.space_id <> private.default_space() and private.can_admin_space(c.space_id))
        or (c.module is distinct from 'TP Ondes et Vibrations' and c.space_id is not null
            and private.can_do_any(c.space_id, array['attendance.any','attendance.edit','attendance.makeup']))
      ));
$function$;
create or replace function private.can_access_student(p_student_id uuid) returns boolean
language sql stable security definer set search_path to '' as $function$
  select exists(
    select 1 from public.students s join public.classes c on c.id = s.class_id
    where s.id = p_student_id and s.deleted_at is null
      and (
        (c.module = 'TP Ondes et Vibrations' and private.is_lpc3_owner())
        or (c.module is distinct from 'TP Ondes et Vibrations' and (
          private.is_admin()
          or s.teacher_id = (select auth.uid())
          or exists (select 1 from public.session_plans sp where sp.class_id = s.class_id and sp.teacher_id = (select auth.uid()) and sp.deleted_at is null)
          or exists (select 1 from public.sessions se where se.class_id = s.class_id and se.teacher_id = (select auth.uid()) and se.deleted_at is null)))
        or (c.space_id <> private.default_space() and private.can_admin_space(c.space_id))
        or (c.module is distinct from 'TP Ondes et Vibrations' and c.space_id is not null
            and private.can_do_any(c.space_id, array['attendance.any','attendance.edit','attendance.makeup','students.edit']))
      ));
$function$;

-- Équipe : un titulaire de « team.edit » ajoute ou retire des enseignants (jamais un administrateur)
create or replace function public.v43_set_member(p_space uuid, p_profile uuid, p_role text) returns void
language plpgsql security definer set search_path to '' as $function$
declare v_old text;
begin
  if p_role is not null and p_role not in ('admin','teacher') then raise exception 'Rôle inconnu'; end if;
  select role into v_old from public.space_members where space_id = p_space and profile_id = p_profile;
  if not private.is_super_admin() then
    if not private.can_do(p_space, 'team.edit') then raise exception 'Réservé à l''administrateur de l''espace'; end if;
    if p_role = 'admin' or v_old = 'admin' then raise exception 'Seul le super administrateur nomme ou retire un administrateur'; end if;
  end if;
  if p_role is null then delete from public.space_members where space_id = p_space and profile_id = p_profile;
  else insert into public.space_members(space_id, profile_id, role) values (p_space, p_profile, p_role)
       on conflict (space_id, profile_id) do update set role = excluded.role;
  end if;
  insert into public.v33_s2_audit(space_id, action, detail)
    values (p_space, 'set_member', jsonb_build_object('profile', p_profile, 'role', p_role, 'before', v_old));
end $function$;

-- Le super administrateur fixe les permissions d'une personne dans un espace (historique + annulation)
create or replace function public.v47_set_permissions(p_space uuid, p_profile uuid, p_perms text[]) returns jsonb
language plpgsql security definer set search_path to '' as $function$
declare v_before text[]; v_after text[];
begin
  if not private.is_super_admin() then raise exception 'Réservé au super administrateur'; end if;
  if exists (select 1 from public.super_admin_owner o where o.user_id = p_profile) then raise exception 'Le super administrateur a déjà toutes les permissions'; end if;
  if not exists (select 1 from public.spaces where id = p_space) then raise exception 'Espace introuvable'; end if;
  select coalesce(array_agg(perm order by perm), '{}') into v_before from public.space_permissions where space_id = p_space and profile_id = p_profile;
  select coalesce(array_agg(distinct x order by x), '{}') into v_after from unnest(coalesce(p_perms, '{}')) x;
  delete from public.space_permissions where space_id = p_space and profile_id = p_profile;
  insert into public.space_permissions(space_id, profile_id, perm, granted_by) select p_space, p_profile, x, auth.uid() from unnest(v_after) x;
  -- Une permission donne accès à l'espace : la personne en devient membre (enseignant) si besoin.
  if cardinality(v_after) > 0 then
    insert into public.space_members(space_id, profile_id, role) values (p_space, p_profile, 'teacher') on conflict (space_id, profile_id) do nothing;
  end if;
  insert into public.v33_s2_audit(space_id, action, detail)
    values (p_space, 'set_permissions', jsonb_build_object('profile', p_profile, 'before', to_jsonb(v_before), 'after', to_jsonb(v_after)));
  return jsonb_build_object('before', to_jsonb(v_before), 'after', to_jsonb(v_after));
end $function$;
revoke all on function public.v47_set_permissions(uuid, uuid, text[]) from public, anon;
grant execute on function public.v47_set_permissions(uuid, uuid, text[]) to authenticated;

-- Planning : toute permission « planning.* » permet le recalcul (un changement de dates, de postes ou de manipulations le déclenche)
create or replace function public.v33_s2_replace_plan(p_from date, p_sessions jsonb, p_reason text DEFAULT NULL::text, p_space uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_deleted int; v_inserted int := 0; s jsonb; g jsonb; v_id uuid;
begin
  if not private.can_do_any(p_space, array['planning.generate','planning.settings','planning.sessions','planning.stations','planning.manips']) then raise exception 'Réservé à l''administrateur de l''espace'; end if;
  if p_from is null or p_from < '2027-01-11' then p_from := '2027-01-11'; end if;
  delete from public.v33_s2_sessions where space_id = p_space and session_date >= p_from and not locked;
  get diagnostics v_deleted = row_count;
  for s in select * from jsonb_array_elements(coalesce(p_sessions,'[]'::jsonb)) loop
    if (s->>'session_date')::date < p_from then continue; end if;
    if not exists (select 1 from public.v33_s2_class_slots cs where cs.class_name = s->>'class_name' and cs.space_id = p_space) then continue; end if;
    if exists (select 1 from public.v33_s2_sessions x where x.class_name = s->>'class_name' and x.session_date = (s->>'session_date')::date) then continue; end if;
    insert into public.v33_s2_sessions(space_id, class_name, session_date, start_time, end_time, occurrence, note)
      values (p_space, s->>'class_name', (s->>'session_date')::date, (s->>'start_time')::time, (s->>'end_time')::time, (s->>'occurrence')::int, s->>'note')
      returning id into v_id;
    for g in select * from jsonb_array_elements(coalesce(s->'slots','[]'::jsonb)) loop
      insert into public.v33_s2_slots(space_id, session_id, group_no, manipulation_code, teacher_id, room)
        values (p_space, v_id, (g->>'group_no')::int, g->>'manipulation_code', nullif(g->>'teacher_id','')::uuid, g->>'room');
    end loop;
    v_inserted := v_inserted + 1;
  end loop;
  insert into public.v33_s2_audit(space_id, action, detail) values (p_space, 'replace_plan', jsonb_build_object('from', p_from, 'deleted', v_deleted, 'inserted', v_inserted, 'reason', p_reason));
  return jsonb_build_object('deleted', v_deleted, 'inserted', v_inserted);
end $function$;

create or replace function public.v33_s2_save_version(p_label text, p_space uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid)
 returns uuid language plpgsql security definer set search_path to '' as $function$
declare v_id uuid;
begin
  if not private.can_do_any(p_space, array['planning.generate','planning.settings','planning.sessions','planning.stations','planning.manips']) then raise exception 'Réservé à l''administrateur de l''espace'; end if;
  insert into public.v33_s2_versions(space_id, label, snapshot, created_by)
  select p_space, p_label, jsonb_build_object(
    'sessions', coalesce((select jsonb_agg(to_jsonb(s) order by s.session_date, s.class_name) from public.v33_s2_sessions s where s.space_id = p_space), '[]'::jsonb),
    'slots', coalesce((select jsonb_agg(to_jsonb(g)) from public.v33_s2_slots g where g.space_id = p_space), '[]'::jsonb)), auth.uid()
  returning id into v_id;
  insert into public.v33_s2_audit(space_id, action, detail) values (p_space, 'save_version', jsonb_build_object('id', v_id, 'label', p_label));
  return v_id;
end $function$;

create or replace function public.v37_s2_auto_replan(p_from date, p_reason text DEFAULT 'recalcul automatique'::text, p_force boolean DEFAULT false, p_space uuid DEFAULT '00000000-0000-4000-8000-000000000001'::uuid)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_from date; plan jsonb; res jsonb;
begin
  if not private.can_do_any(p_space, array['planning.generate','planning.settings','planning.sessions','planning.stations','planning.manips']) then raise exception 'Réservé à l''administrateur de l''espace'; end if;
  if not p_force and not exists (select 1 from public.v33_s2_sessions where space_id = p_space) then
    return jsonb_build_object('skipped', true, 'reason', 'aucun planning généré');
  end if;
  v_from := greatest(coalesce(p_from, date '2027-01-11'), current_date, date '2027-01-11');
  plan := public.v37_s2_compute_plan(v_from, p_space);
  if exists (select 1 from public.v33_s2_sessions where space_id = p_space) then
    perform public.v33_s2_save_version(left('Sauvegarde avant ' || coalesce(p_reason, 'recalcul') || ' du ' || to_char(v_from, 'DD/MM/YYYY'), 120), p_space);
  end if;
  res := public.v33_s2_replace_plan(v_from, plan->'sessions', p_reason, p_space);
  return res || jsonb_build_object('from', v_from, 'warnings', plan->'warnings');
end $function$;

create or replace function public.v33_s2_restore_version(p_id uuid)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v jsonb; n int; v_space uuid;
begin
  select snapshot, space_id into v, v_space from public.v33_s2_versions where id = p_id;
  if v is null then raise exception 'Version introuvable'; end if;
  if not private.can_do(v_space, 'planning.generate') then raise exception 'Réservé à l''administrateur de l''espace'; end if;
  delete from public.v33_s2_sessions where space_id = v_space;
  insert into public.v33_s2_sessions select * from jsonb_populate_recordset(null::public.v33_s2_sessions,
    (select coalesce(jsonb_agg(e || jsonb_build_object('space_id', v_space)), '[]'::jsonb) from jsonb_array_elements(v->'sessions') e));
  get diagnostics n = row_count;
  insert into public.v33_s2_slots select * from jsonb_populate_recordset(null::public.v33_s2_slots,
    (select coalesce(jsonb_agg(e || jsonb_build_object('space_id', v_space)), '[]'::jsonb) from jsonb_array_elements(v->'slots') e));
  insert into public.v33_s2_audit(space_id, action, detail) values (v_space, 'restore_version', jsonb_build_object('id', p_id, 'sessions', n));
  return jsonb_build_object('sessions', n);
end $function$;

-- Appel S2 : l'enseignant de la case, ou une personne ayant « attendance.any » dans l'espace
create or replace function public.v44_s2_start_slot(p_slot_id uuid) returns uuid
language plpgsql security definer set search_path to '' as $$
declare
  v_slot public.v33_s2_slots%rowtype; v_ses public.v33_s2_sessions%rowtype;
  v_teacher uuid; v_st uuid; v_name text; v_class uuid; v_module text; v_session uuid;
begin
  if auth.uid() is null or not private.mutation_allowed() then raise exception 'Connexion requise'; end if;
  select * into v_slot from public.v33_s2_slots where id = p_slot_id for update;
  if not found then raise exception 'Case du planning introuvable'; end if;
  select * into v_ses from public.v33_s2_sessions where id = v_slot.session_id;
  -- Seul l'enseignant de la case, ou un administrateur de l'espace, ouvre l'appel.
  if v_slot.teacher_id is distinct from auth.uid() and not private.can_do(v_slot.space_id, 'attendance.any') then
    raise exception 'Cette case n''est pas attribuée à votre compte';
  end if;
  if v_slot.attendance_session_id is not null and exists (select 1 from public.sessions s where s.id = v_slot.attendance_session_id and s.deleted_at is null) then
    return v_slot.attendance_session_id;
  end if;
  v_teacher := coalesce(v_slot.teacher_id, auth.uid());
  v_name := v_ses.class_name || '-G' || v_slot.group_no;
  -- Liste du groupe dans l'espace (créée si besoin)
  select c.id into v_class from public.classes c where c.name = v_name and c.space_id = v_slot.space_id and c.deleted_at is null limit 1;
  if v_class is null then
    select c.module into v_module from public.classes c where c.space_id = v_slot.space_id and c.deleted_at is null
      and (c.name = v_ses.class_name or c.name like v_ses.class_name || '-G%') limit 1;
    insert into public.classes(teacher_id, name, module, space_id, group_number, updated_by)
      values (v_teacher, v_name, coalesce(v_module, 'TP Physique S2'), v_slot.space_id, v_slot.group_no, auth.uid())
      returning id into v_class;
  end if;
  -- Les étudiants actifs du groupe S2 rejoignent la liste du groupe (leurs présences passées sont conservées).
  for v_st in select st.id from public.students st
     where st.deleted_at is null and st.class_id is distinct from v_class
       and st.id in (select m.student_id from public.v33_s2_group_members m
                      where m.space_id = v_slot.space_id and m.class_name = v_ses.class_name and m.group_no = v_slot.group_no and m.status = 'actif')
  loop
    -- MPI1 · PC1 : le changement est daté dans l'historique (comme v16_set_student_group) ; le groupe du S1 reste lisible.
    if v_slot.space_id = private.default_space() then
      perform pg_advisory_xact_lock(hashtextextended('v16-student-membership|'||v_st::text,0));
      if exists (select 1 from public.v16_student_group_memberships where student_id = v_st and effective_from = v_ses.session_date) then
        update public.v16_student_group_memberships set class_id = v_class, group_no = v_slot.group_no, active = true, changed_by = auth.uid(), updated_at = now()
         where student_id = v_st and effective_from = v_ses.session_date;
      else
        update public.v16_student_group_memberships set effective_to = v_ses.session_date, active = false, changed_by = auth.uid(), updated_at = now()
         where student_id = v_st and effective_from < v_ses.session_date and (effective_to is null or effective_to > v_ses.session_date);
        insert into public.v16_student_group_memberships(student_id, class_id, group_no, effective_from, effective_to, active, changed_by)
          values (v_st, v_class, v_slot.group_no, v_ses.session_date,
                  (select min(effective_from) from public.v16_student_group_memberships where student_id = v_st and effective_from > v_ses.session_date), true, auth.uid());
      end if;
    end if;
    update public.students set class_id = v_class, updated_at = now(), updated_by = auth.uid() where id = v_st;
  end loop;
  -- Même séance déjà créée à la main pour ce groupe et cette date : on la réutilise.
  select s.id into v_session from public.sessions s where s.class_id = v_class and s.session_date = v_ses.session_date and s.deleted_at is null limit 1;
  if v_session is null then
    insert into public.sessions(teacher_id, class_id, session_date, start_time, end_time, updated_by)
      values (v_teacher, v_class, v_ses.session_date, v_ses.start_time, v_ses.end_time, auth.uid())
      returning id into v_session;
  end if;
  update public.v33_s2_slots set attendance_session_id = v_session where id = v_slot.id;
  insert into public.v33_s2_audit(space_id, action, detail)
    values (v_slot.space_id, 'start_attendance', jsonb_build_object('slot', v_slot.id, 'session', v_session, 'class', v_name, 'date', v_ses.session_date));
  return v_session;
end $$;
