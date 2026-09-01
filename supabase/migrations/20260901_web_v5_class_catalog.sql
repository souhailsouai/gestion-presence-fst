-- Normalize legacy class labels/modules for the V5 TP Physique catalog.
update public.classes
set module='TP Physique',
    name=case
      when track='MPI' and class_number between 1 and 5 and group_number between 1 and 4
        then 'MPI1-' || chr(64+class_number) || '-G' || group_number
      when track='PC' and class_number=1 and group_number between 1 and 4
        then 'PC1-A-G' || group_number
      else name
    end,
    updated_at=now()
where deleted_at is null;

alter table public.classes drop constraint if exists classes_v5_catalog_check;
alter table public.classes add constraint classes_v5_catalog_check
check (
  (track='MPI' and class_number between 1 and 5 and group_number between 1 and 4)
  or (track='PC' and class_number=1 and group_number between 1 and 4)
);

alter table public.classes drop constraint if exists classes_v5_module_check;
alter table public.classes add constraint classes_v5_module_check
check (module='TP Physique');