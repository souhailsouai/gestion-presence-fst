-- V53 — Changer l'horaire d'une classe (Créneaux S2) le change partout, automatiquement.
-- Quand le début ou la fin d'une classe change, les séances S2 à venir de cette classe
-- (et les séances d'appel déjà ouvertes pour ces dates) prennent le nouvel horaire :
-- planning, cahier de présence, PDF, appel, carte « Maintenant ».
-- Ne change jamais : les séances passées, ni une séance dont l'horaire avait été réglé autrement.
-- Aucune donnée existante n'est modifiée par cette migration elle-même.

create or replace function private.v53_class_time_sync() returns trigger
language plpgsql security definer set search_path to '' as $f$
declare v_today date := (now() at time zone 'Africa/Tunis')::date;
begin
  -- Autorise uniquement ce changement d'horaire dans le garde des séances (voir plus bas).
  perform set_config('app.v53_time_sync', 'on', true);
  update public.sessions x set start_time = new.start_time, end_time = new.end_time
    from public.v33_s2_slots sl join public.v33_s2_sessions s on s.id = sl.session_id
   where sl.attendance_session_id = x.id
     and s.space_id = new.space_id and s.class_name = new.class_name
     and x.session_date >= v_today and x.deleted_at is null
     and x.start_time = old.start_time and x.end_time = old.end_time;
  update public.v33_s2_sessions s set start_time = new.start_time, end_time = new.end_time
   where s.space_id = new.space_id and s.class_name = new.class_name
     and s.session_date >= v_today
     and s.start_time = old.start_time and s.end_time = old.end_time;
  perform set_config('app.v53_time_sync', 'off', true);
  insert into public.v33_s2_audit(space_id, action, detail)
    values (new.space_id, 'class_time', jsonb_build_object('class', new.class_name,
      'from', to_char(old.start_time, 'HH24:MI') || '–' || to_char(old.end_time, 'HH24:MI'),
      'to', to_char(new.start_time, 'HH24:MI') || '–' || to_char(new.end_time, 'HH24:MI')));
  return new;
end $f$;

drop trigger if exists v53_class_time_sync on public.v33_s2_class_slots;
create trigger v53_class_time_sync
  after update of start_time, end_time on public.v33_s2_class_slots
  for each row when (old.start_time is distinct from new.start_time or old.end_time is distinct from new.end_time)
  execute function private.v53_class_time_sync();

-- Garde des séances : un responsable d'espace qui n'est pas administrateur global peut
-- désormais déplacer l'horaire via le changement de créneau de la classe (et rien d'autre).
create or replace function public.enforce_v5_session_identity()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if auth.uid() is null or public.current_user_is_admin() then
    return new;
  end if;

  if current_setting('app.v53_time_sync', true) = 'on'
     and new.teacher_id is not distinct from old.teacher_id
     and new.class_id is not distinct from old.class_id
     and new.session_date is not distinct from old.session_date
     and new.assignment_id is not distinct from old.assignment_id
     and new.group_id is not distinct from old.group_id
     and new.course_id is not distinct from old.course_id
  then
    return new;
  end if;

  if old.teacher_id is distinct from auth.uid() then
    raise exception 'session read only';
  end if;

  if new.teacher_id is distinct from old.teacher_id
     or new.class_id is distinct from old.class_id
     or new.session_date is distinct from old.session_date
     or new.start_time is distinct from old.start_time
     or new.end_time is distinct from old.end_time
     or new.assignment_id is distinct from old.assignment_id
     or new.group_id is distinct from old.group_id
     or new.course_id is distinct from old.course_id
  then
    raise exception 'assigned teacher can only update session completion metadata';
  end if;

  return new;
end;
$function$;
