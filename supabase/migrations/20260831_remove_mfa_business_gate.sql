begin;

-- Business authorization is based on authenticated identity plus role/ownership.
-- MFA/AAL2 is no longer part of the application authorization contract.
create or replace function private.mutation_allowed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null;
$$;

revoke all on function private.mutation_allowed() from public, anon, authenticated;

insert into public.app_config(key, value)
values (
  'authentication',
  jsonb_build_object(
    'methods', jsonb_build_array('pin', 'password'),
    'mfa_required', false
  )
)
on conflict (key) do update
set value = excluded.value,
    updated_at = now();

delete from public.app_config where key = 'mfa_policy';

create or replace function public.get_app_contract()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'schema_version', coalesce((select value from public.app_config where key='schema_version'), '2'::jsonb),
    'academic_year', coalesce((select value from public.app_config where key='academic_year'), to_jsonb('2026/2027'::text)),
    'maintenance', coalesce((select value from public.app_config where key='maintenance'), '{}'::jsonb),
    'minimum_client_versions', coalesce((select value from public.app_config where key='minimum_client_versions'), '{}'::jsonb),
    'authentication', coalesce(
      (select value from public.app_config where key='authentication'),
      jsonb_build_object('methods', jsonb_build_array('pin','password'), 'mfa_required', false)
    ),
    'server_time', now()
  )
  where auth.uid() is not null;
$$;

grant execute on function public.get_app_contract() to authenticated;

commit;
