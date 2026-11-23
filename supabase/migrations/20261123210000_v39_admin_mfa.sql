-- V39 — Sécurité : les pouvoirs d'administrateur exigent la double authentification (AAL2).
-- Le site et l'application demandent le code TOTP dès que profiles.mfa_required est vrai.
-- Les enseignants ne sont pas concernés (mfa_required reste inchangé pour eux).

update public.profiles set mfa_required = true, updated_at = now()
 where role = 'admin' and deleted_at is null;

update public.app_config
   set value = jsonb_set(value, '{administrators}', '"required"')
 where key = 'mfa_policy';

create or replace function public.current_user_is_admin()
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp' as $$
  select exists(
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.deleted_at is null
  ) and coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2';
$$;

create or replace function private.is_admin()
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin' and p.deleted_at is null
  ) and coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2';
$$;

-- Fonction inutilisée par le site et l'application : plus appelable depuis l'API.
revoke execute on function public.v18_dematerialize_premature_sessions() from authenticated, anon, public;
