-- V38 — Salles fixes du S1 : M1 → C, M2 et M5 → B, M3 et M6 → A, M4 → D.
-- Les salles A et B accueillent deux manipulations en même temps : la règle
-- « une salle = un groupe » devient « une salle = autant de groupes que de
-- manipulations qui lui sont attribuées ».

insert into public.v515_manipulation_rooms(manipulation_code, room) values
  ('M1','C'),('M2','B'),('M3','A'),('M4','D'),('M5','B'),('M6','A')
on conflict (manipulation_code) do update set room = excluded.room;

create or replace function private.v38_room_capacity(p_room text)
returns integer language sql stable set search_path = '' as $$
  select greatest(1, (select count(*)::int from public.v515_manipulation_rooms where room = p_room));
$$;

-- Sauvegarde des salles avant correction.
create table if not exists backup_20261122_enseignants_s1.v515_assignments_rooms_v38 as
  select id, session_id, group_no, manipulation_code, room from public.v515_assignments;

-- Garde-fous temps réel (affectations réelles et mode test).
create or replace function private.v16_enforce_real_room_conflict()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op='UPDATE' and new.room is not distinct from old.room and new.session_id is not distinct from old.session_id then
    return new;
  end if;
  if new.room is null then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('v16-real-room|' || new.session_id::text || '|' || new.room, 0));
  if (select count(*) from public.v515_assignments a
      where a.session_id = new.session_id and a.room = new.room and a.id is distinct from new.id)
     >= private.v38_room_capacity(new.room) then
    raise exception using errcode='23505', message='ROOM_TIME_CONFLICT';
  end if;
  return new;
end;
$$;

create or replace function private.v16_enforce_test_room_conflict()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op='UPDATE' and new.room is not distinct from old.room and new.test_session_id is not distinct from old.test_session_id then
    return new;
  end if;
  if new.room is null then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('v16-test-room|' || new.test_session_id::text || '|' || new.room, 0));
  if (select count(*) from public.v16_test_assignments a
      where a.test_session_id = new.test_session_id and a.room = new.room and a.id is distinct from new.id)
     >= private.v38_room_capacity(new.room) then
    raise exception using errcode='23505', message='ROOM_TIME_CONFLICT';
  end if;
  return new;
end;
$$;

-- Contrôles par semaine : même règle de capacité.
do $$
declare
  r record; def text; nd text;
begin
  for r in select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where (n.nspname, p.proname) in (('public','v16_save_week_plan'),('public','v16_save_test_week_plan'),('private','v16_verify_test_apply_week'))
  loop
    def := pg_get_functiondef(r.oid);
    nd := regexp_replace(def, 'group by (session_id|session_date),\s*room\s+having count\(\*\)\s*>\s*1',
                         'group by \1,room having count(*)>private.v38_room_capacity(room)', 'g');
    if nd = def then raise exception 'V38: motif introuvable dans %', r.proname; end if;
    execute nd;
  end loop;
end $$;

-- Correction des affectations existantes (déclencheurs différés : vérifiés à la fin).
update public.v515_assignments a
   set room = mr.room
  from public.v515_manipulation_rooms mr
 where mr.manipulation_code = a.manipulation_code
   and a.room is distinct from mr.room;

update public.session_plans sp
   set room = mr.room
  from public.v515_manipulation_rooms mr
 where mr.manipulation_code = sp.manipulation
   and sp.deleted_at is null
   and sp.room is distinct from mr.room;
