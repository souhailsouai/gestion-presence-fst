-- V44b — Les contrôles du catalogue des classes (MPI1-A à E, PC1-A, LPC3) restent stricts pour l'espace MPI1 · PC1 ;
-- les autres espaces peuvent créer leurs propres classes (nom libre, module TP, groupes 1 à 12).
alter table public.classes drop constraint classes_v5_catalog_check;
alter table public.classes drop constraint classes_v5_module_check;
alter table public.classes drop constraint classes_group_number_tp_check;
alter table public.classes add constraint classes_v5_catalog_check check (
  space_id <> '00000000-0000-4000-8000-000000000001'::uuid
  or ((track = 'MPI') and (class_number between 1 and 5) and (group_number between 1 and 6) and (module = 'TP Physique'))
  or ((track = 'PC') and (class_number = 1) and (group_number between 1 and 6) and (module = 'TP Physique'))
  or ((track = 'LPC') and (class_number = 3) and (group_number between 1 and 4) and (module = 'TP Ondes et Vibrations')
      and (teacher_id = 'e9a874d5-4e7e-48f2-a8bd-d59003599570'::uuid) and (name ~ '^LPC3-G[1-4]$')));
alter table public.classes add constraint classes_v5_module_check check (
  module = any (array['TP Physique','TP Ondes et Vibrations'])
  or (space_id <> '00000000-0000-4000-8000-000000000001'::uuid and length(module) between 2 and 60));
alter table public.classes add constraint classes_group_number_tp_check check (
  group_number is null or (group_number between 1 and 6)
  or (space_id <> '00000000-0000-4000-8000-000000000001'::uuid and group_number between 1 and 12));
