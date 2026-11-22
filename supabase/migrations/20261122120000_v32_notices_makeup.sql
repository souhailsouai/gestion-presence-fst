-- V32 : avis modifiables par l'administrateur + rattrapage des absences.
-- Changements additifs uniquement (nouvelle table, nouvelles colonnes nullables).

create table if not exists public.app_notices (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 200),
  body text not null default '' check (length(body) <= 5000),
  position integer not null default 0,
  published boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.app_notices enable row level security;

drop policy if exists app_notices_select on public.app_notices;
create policy app_notices_select on public.app_notices
  for select to authenticated
  using (published or public.current_user_is_admin());

drop policy if exists app_notices_admin_write on public.app_notices;
create policy app_notices_admin_write on public.app_notices
  for all to authenticated
  using (public.current_user_is_admin())
  with check (public.current_user_is_admin());

grant select, insert, update, delete on public.app_notices to authenticated;

create or replace function public.app_notices_touch() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

drop trigger if exists app_notices_touch on public.app_notices;
create trigger app_notices_touch before insert or update on public.app_notices
  for each row execute function public.app_notices_touch();

-- Rattrapage : l'absence d'origine passe en « présent » (elle ne compte plus
-- comme absence dans les statistiques existantes) et garde la date du rattrapage.
alter table public.attendance add column if not exists makeup_date date;
alter table public.attendance add column if not exists makeup_note text check (makeup_note is null or length(makeup_note) <= 300);

-- Avis de départ = avis actuellement affichés dans l'application.
insert into public.app_notices (title, body, position)
select * from (values
 ('Avis officiels',
  '**Horaire des TP de Physique :** 14h00–17h00.
**Lundi :** MPI1-A à partir du 14/09/2026 ; MPI1-E à partir du 21/09/2026.
**Jeudi :** MPI1-C à partir du 17/09/2026 ; MPI1-D à partir du 24/09/2026.
**Vendredi :** MPI1-B du 18/09/2026 au 23/10/2026 ; PC1-A commence les TP de Physique le 06/11/2026. Pendant la période MPI1-B, PC1-A suit ses TP de Chimie et de STA.
**Semaine des DS :** du 26/10/2026 au 31/10/2026 — aucun TP de Physique.
**Jeudi 15/10/2026 :** jour férié — aucun TP.', 1),
 ('Avis n°1 — Démarrage des TP MPI1',
  '**MPI1-A et MPI1-E** : lundi 14/09/2026 à **13h45**.
**MPI1-C et MPI1-D** : jeudi 17/09/2026 à **13h30**.
**MPI1-B** : vendredi 18/09/2026 à **13h30**.
**Salles A, B, C et D** — rez-de-chaussée, à l’entrée du Département de Physique.
**Avis du 11/09/2026** — Coordinateur : Souhail Souai — souhail.souai@fst.utm.tn', 2),
 ('Avis n°1 — Démarrage des TP PC1',
  '**PC1-A** : vendredi 18/09/2026 à **13h30**.
**Salles A, B, C et D** — rez-de-chaussée, à l’entrée du Département de Physique.
**Avis du 11/09/2026** — Coordinateur : Souhail Souai — souhail.souai@fst.utm.tn', 3)
) v(title, body, position)
where not exists (select 1 from public.app_notices);
