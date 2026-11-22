-- V32 : rattrapage d'absence (appliqué en production le 22/11/2026, après sauvegarde backup_20261122).
-- Additif : deux colonnes nullables. Une absence rattrapée passe en status='present' et garde la date.
alter table public.attendance add column if not exists makeup_date date;
alter table public.attendance add column if not exists makeup_note text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname='attendance_makeup_note_len') then
    alter table public.attendance add constraint attendance_makeup_note_len check (makeup_note is null or length(makeup_note) <= 300);
  end if;
end $$;
comment on column public.attendance.makeup_date is 'V32 : date du rattrapage. Une absence rattrapée passe en status=present et garde cette date.';
-- Les avis modifiables réutilisent la table existante public.v21_notices (pas de nouvelle table).
