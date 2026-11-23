-- V40 — Retrait du mode test / démo : le site fonctionne uniquement en mode réel.
-- Les tables de test sont archivées (schéma de sauvegarde) puis supprimées ;
-- les fonctions de test ne sont plus appelables depuis l'API.

create table if not exists backup_20261122_enseignants_s1.v16_test_sessions_v40 as table public.v16_test_sessions;
create table if not exists backup_20261122_enseignants_s1.v16_test_assignments_v40 as table public.v16_test_assignments;
create table if not exists backup_20261122_enseignants_s1.v16_test_attendance_v40 as table public.v16_test_attendance;
create table if not exists backup_20261122_enseignants_s1.v16_test_scenarios_v40 as table public.v16_test_scenarios;

do $$
declare r record;
begin
  for r in select p.oid::regprocedure f from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname = any (array[
             'v16_clone_real_to_test','v16_apply_test_teacher_plan','v16_preview_test_apply','v16_reset_test_context',
             'v16_save_test_week_plan','v17_reset_demo_from_real','v18_set_runtime_mode','v18_get_runtime_mode',
             'v18_demo_sessions_for_current_user','v18_demo_students_for_session','v18_get_demo_attendance',
             'v18_save_demo_attendance','v18_swap_demo_teachers'])
  loop
    execute 'revoke execute on function ' || r.f || ' from public, anon, authenticated';
  end loop;
end $$;

drop table if exists public.v16_test_attendance, public.v16_test_assignments, public.v16_test_sessions, public.v16_test_scenarios cascade;
