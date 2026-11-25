-- V44c — Correctif de sécurité : can_admin_space / can_read_space renvoyaient NULL (et non « faux ») pour une personne
-- hors de l'espace ; dans les fonctions, « if not NULL » ne bloquait pas. Elles renvoient maintenant toujours vrai ou faux.
create or replace function private.can_read_space(p_space uuid) returns boolean
language sql stable security definer set search_path to '' as $$
  select coalesce(private.is_super_admin(), false)
      or (coalesce(private.is_admin(), false) and p_space = private.default_space())
      or private.space_role(p_space) is not null;
$$;
create or replace function private.can_admin_space(p_space uuid) returns boolean
language sql stable security definer set search_path to '' as $$
  select coalesce(private.is_super_admin(), false)
      or (coalesce(private.is_admin(), false) and p_space = private.default_space())
      or coalesce(private.space_role(p_space) = 'admin', false);
$$;
