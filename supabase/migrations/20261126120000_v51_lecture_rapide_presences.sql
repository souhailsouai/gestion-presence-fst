-- V51 — Lecture rapide des séances et des présences (ouverture de l'application).
-- La règle d'accès est inchangée : la liste des séances visibles est calculée une seule fois
-- par requête, au lieu de revérifier tous les droits pour chacune des lignes de présence.
-- Vérifié avant application (4 comptes) : mêmes séances et mêmes présences, lecture ~10× plus rapide.
-- Retour arrière : recréer les deux politiques avec « private.can_access_session(session_id) » / « (id) ».
create or replace function private.accessible_session_ids() returns setof uuid
language sql stable security definer set search_path to '' as $f$
  select s.id from public.sessions s join public.classes c on c.id = s.class_id
  where s.deleted_at is null and (
    (c.module = 'TP Ondes et Vibrations' and (select private.is_lpc3_owner()))
    or (c.module is distinct from 'TP Ondes et Vibrations' and ((select private.is_admin()) or s.teacher_id = (select auth.uid())))
    or (c.space_id <> private.default_space() and private.can_admin_space(c.space_id))
    or (c.module is distinct from 'TP Ondes et Vibrations' and c.space_id is not null
        and private.can_do_any(c.space_id, array['attendance.any','attendance.edit','attendance.makeup'])));
$f$;
revoke all on function private.accessible_session_ids() from public;
grant execute on function private.accessible_session_ids() to authenticated;

drop policy if exists attendance_select_authorized on public.attendance;
create policy attendance_select_authorized on public.attendance for select to authenticated
  using (session_id in (select private.accessible_session_ids()));

drop policy if exists sessions_select_authorized on public.sessions;
create policy sessions_select_authorized on public.sessions for select to authenticated
  using (id in (select private.accessible_session_ids()));
