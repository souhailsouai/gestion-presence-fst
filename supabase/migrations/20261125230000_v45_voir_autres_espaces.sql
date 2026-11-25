-- V45 — Tout enseignant peut CONSULTER le planning S2 des autres espaces (au choix, « Autres espaces »).
-- Seulement le planning : séances, cases, créneaux, manipulations, réglages, postes, dates exclues.
-- Les listes d'étudiants, les groupes, les versions et le journal restent réservés aux membres de l'espace.
create or replace function private.can_view_space(p_space uuid) returns boolean
language sql stable security definer set search_path to '' as $$
  select private.can_read_space(p_space)
      or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.deleted_at is null);
$$;
grant execute on function private.can_view_space(uuid) to authenticated;

drop policy if exists spaces_read on public.spaces;
create policy spaces_read on public.spaces for select to authenticated using (private.can_view_space(id));
do $$ declare t text; begin
  foreach t in array array['v33_s2_sessions','v33_s2_slots','v33_s2_class_slots','v33_s2_manipulations','v33_s2_settings','v33_s2_stations','v33_s2_excluded_dates'] loop
    execute format('drop policy if exists %I on public.%I', t||'_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (private.can_view_space(space_id))', t||'_read', t);
  end loop;
end $$;

-- Le site et l'application savent si l'utilisateur est le super administrateur (et non un simple administrateur).
create or replace function public.v45_am_super_admin() returns boolean
language sql stable security definer set search_path to '' as $$ select coalesce(private.is_super_admin(), false); $$;
revoke all on function public.v45_am_super_admin() from public, anon;
grant execute on function public.v45_am_super_admin() to authenticated;
