-- V41 — Demande de l'administrateur (24/11/2026) : ne plus confirmer chaque connexion par un code.
-- La double authentification redevient facultative pour les administrateurs ; les pouvoirs
-- d'administrateur ne dépendent plus du niveau AAL2 (annule l'exigence introduite par V39).
-- Les appareils TOTP déjà enregistrés restent en place et peuvent être retirés depuis « Mon compte ».

update public.profiles set mfa_required = false, updated_at = now()
 where role = 'admin' and deleted_at is null;

update public.app_config
   set value = jsonb_set(value, '{administrators}', '"optional"')
 where key = 'mfa_policy';

create or replace function public.current_user_is_admin()
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp' as $$
  select exists(
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.deleted_at is null
  );
$$;

create or replace function private.is_admin()
returns boolean language sql stable security definer
set search_path to 'public', 'pg_temp' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin' and p.deleted_at is null
  );
$$;
