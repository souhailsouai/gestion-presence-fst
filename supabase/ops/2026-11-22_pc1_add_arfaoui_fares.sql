-- PC1 2026-2027 : ajout de ARFAOUI Fares en PC1-A-G3
-- Source : cahier de presence PC1-A G3 (present les 06/11, 13/11 et 20/11/2026).
-- A executer dans Supabase (SQL editor) APRES 2026-10-17_pc1_roster_2026_2027.sql.
-- Idempotent : ne cree pas de doublon si l'etudiant existe deja.
begin;

do $$
declare
  v_class_count integer;
begin
  select count(*) into v_class_count
  from public.classes
  where name='PC1-A-G3' and deleted_at is null;
  if v_class_count <> 1 then
    raise exception 'Expected exactly 1 active PC1-A-G3 class, got %', v_class_count;
  end if;
end $$;

insert into public.students(id,teacher_id,class_id,last_name,first_name,email)
select gen_random_uuid(), c.teacher_id, c.id, 'Arfaoui', 'Fares', null
from public.classes c
where c.name='PC1-A-G3'
  and c.deleted_at is null
  and not exists(
    select 1
    from public.students s
    join public.classes sc on sc.id=s.class_id
    where sc.name ~ '^PC1-A-G[1-6]$'
      and s.deleted_at is null
      and lower(regexp_replace(trim(concat_ws(' ',s.last_name,s.first_name)),'\s+',' ','g'))
          in ('arfaoui fares','fares arfaoui')
  );

do $$
declare
  v_total integer;
  v_g3 integer;
begin
  select count(*) into v_total
  from public.students s
  join public.classes c on c.id=s.class_id
  where c.name ~ '^PC1-A-G[1-6]$' and s.deleted_at is null;
  if v_total <> 46 then
    raise exception 'PC1 roster check failed: expected 46 active students, got %', v_total;
  end if;

  select count(*) into v_g3
  from public.students s
  join public.classes c on c.id=s.class_id
  where c.name='PC1-A-G3' and s.deleted_at is null;
  if v_g3 <> 8 then
    raise exception 'PC1-A-G3 check failed: expected 8 active students, got %', v_g3;
  end if;
end $$;

commit;
