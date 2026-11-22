-- V37 — Semestre 2 : replanification automatique côté serveur.
-- Même algorithme que web/v33-s2-core.js generatePlan (rotation M((g-1)+(n-1)) mod N + 1,
-- paires alternance / bloc, dates exclues validées évitées, séances verrouillées ou
-- antérieures à la date de départ conservées). Aucune séance avant le 11/01/2027.

create or replace function public.v37_s2_compute_plan(p_from date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_sd date; v_ed date; v_gc int; v_mc int; v_start date; v_from date; v_end date;
  pk record; cls text[]; n int; v_weekday int; v_mode text;
  done jsonb; taken date[]; last_cls text; turn int; d date; pick int; i int; c text; occ int;
  sessions jsonb := '[]'::jsonb; warnings jsonb := '[]'::jsonb; slots jsonb; g int; v_code text; v_teacher uuid; v_room text;
  all_done boolean;
begin
  select start_date, end_date, group_count, manip_count into v_sd, v_ed, v_gc, v_mc from public.v33_s2_settings where id = 1;
  v_gc := coalesce(v_gc, 6); v_mc := coalesce(v_mc, 6);
  v_start := greatest(coalesce(v_sd, date '2027-01-11'), date '2027-01-11');
  v_from := greatest(coalesce(p_from, v_start), v_start);
  v_end := coalesce(v_ed, v_start + 210);

  for pk in
    select pair_key, array_agg(class_name order by pair_order, class_name) as names,
           min(weekday) as wd, max(weekday) as wd2, (array_agg(mode order by pair_order, class_name))[1] as mode
    from public.v33_s2_class_slots where active group by pair_key order by pair_key
  loop
    cls := pk.names; n := array_length(cls, 1); v_weekday := pk.wd; v_mode := coalesce(pk.mode, 'alternance');
    if pk.wd <> pk.wd2 then warnings := warnings || to_jsonb('Paire « ' || pk.pair_key || ' » : les classes n''ont pas le même jour.'); end if;
    done := '{}'::jsonb;
    foreach c in array cls loop
      done := done || jsonb_build_object(c, (select count(*) from public.v33_s2_sessions s where s.class_name = c and (s.locked or s.session_date < v_from)));
    end loop;
    select coalesce(array_agg(s.session_date), '{}') into taken from public.v33_s2_sessions s
      where s.class_name = any(cls) and (s.locked or s.session_date < v_from);
    select s.class_name into last_cls from public.v33_s2_sessions s
      where s.class_name = any(cls) and (s.locked or s.session_date < v_from) and s.session_date < v_from
      order by s.session_date desc, s.class_name desc limit 1;
    turn := case when last_cls is null then 0 else array_position(cls, last_cls) % n end; -- index 0-based du suivant
    d := v_from; while extract(isodow from d)::int <> v_weekday loop d := d + 1; end loop;
    while d <= v_end loop
      all_done := true;
      foreach c in array cls loop if (done->>c)::int < v_mc then all_done := false; end if; end loop;
      exit when all_done;
      if not exists (select 1 from public.v33_s2_excluded_dates x where x.validated and d between x.starts_on and x.ends_on)
         and not (d = any(taken)) then
        pick := null;
        if v_mode = 'bloc' then
          for i in 1..n loop if (done->>cls[i])::int < v_mc then pick := i; exit; end if; end loop;
        else
          for i in 0..n-1 loop
            if (done->>cls[((turn + i) % n) + 1])::int < v_mc then
              pick := ((turn + i) % n) + 1; turn := (turn + i + 1) % n; exit;
            end if;
          end loop;
        end if;
        exit when pick is null;
        occ := (done->>cls[pick])::int + 1; done := done || jsonb_build_object(cls[pick], occ);
        slots := '[]'::jsonb;
        for g in 1..v_gc loop
          v_code := 'M' || (((g - 1) + (occ - 1)) % v_mc + 1);
          v_teacher := null; v_room := null;
          select s.teacher_id, s.room into v_teacher, v_room from public.v33_s2_stations s
            where s.manipulation_code = v_code and s.weekday = v_weekday;
          if coalesce(v_room, '') = '' then select m.room into v_room from public.v33_s2_manipulations m where m.code = v_code; end if;
          slots := slots || jsonb_build_object('group_no', g, 'manipulation_code', v_code, 'teacher_id', v_teacher, 'room', coalesce(v_room, ''));
        end loop;
        sessions := sessions || jsonb_build_object(
          'class_name', cls[pick], 'session_date', d,
          'start_time', (select to_char(cs.start_time, 'HH24:MI') from public.v33_s2_class_slots cs where cs.class_name = cls[pick]),
          'end_time', (select to_char(cs.end_time, 'HH24:MI') from public.v33_s2_class_slots cs where cs.class_name = cls[pick]),
          'occurrence', occ, 'slots', slots);
      end if;
      d := d + 7;
    end loop;
    foreach c in array cls loop
      if (done->>c)::int < v_mc then
        warnings := warnings || to_jsonb(c || ' : seulement ' || (done->>c) || ' séance(s) sur ' || v_mc || ' avant le ' || to_char(v_end, 'DD/MM/YYYY') || '.');
      end if;
    end loop;
  end loop;
  return jsonb_build_object('from', v_from, 'sessions',
    coalesce((select jsonb_agg(e order by e->>'session_date', e->>'class_name') from jsonb_array_elements(sessions) e), '[]'::jsonb),
    'warnings', warnings);
end $$;

-- Recalcule et enregistre le planning à partir de p_from (sauvegarde automatique avant).
-- Ne fait rien tant qu'aucun planning n'a été généré (p_force = false).
create or replace function public.v37_s2_auto_replan(p_from date, p_reason text default 'recalcul automatique', p_force boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_from date; plan jsonb; res jsonb;
begin
  if not public.current_user_is_admin() then raise exception 'Réservé à l''administrateur'; end if;
  if not p_force and not exists (select 1 from public.v33_s2_sessions) then
    return jsonb_build_object('skipped', true, 'reason', 'aucun planning généré');
  end if;
  -- Les séances déjà passées ne sont jamais déplacées.
  v_from := greatest(coalesce(p_from, date '2027-01-11'), current_date, date '2027-01-11');
  plan := public.v37_s2_compute_plan(v_from);
  if exists (select 1 from public.v33_s2_sessions) then
    perform public.v33_s2_save_version(left('Sauvegarde avant ' || coalesce(p_reason, 'recalcul') || ' du ' || to_char(v_from, 'DD/MM/YYYY'), 120));
  end if;
  res := public.v33_s2_replace_plan(v_from, plan->'sessions', p_reason);
  return res || jsonb_build_object('from', v_from, 'warnings', plan->'warnings');
end $$;

-- Déclencheurs : toute modification d'une date exclue VALIDÉE (site, application, import)
-- relance le planning à partir de la plus ancienne date touchée.
create or replace function public.v37_s2_excluded_changed()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_from date;
begin
  if tg_op = 'INSERT' then
    select min(starts_on) into v_from from new_rows where validated;
  elsif tg_op = 'DELETE' then
    select min(starts_on) into v_from from old_rows where validated;
  else
    select min(x) into v_from from (
      select least(n.starts_on, o.starts_on) as x from new_rows n join old_rows o on o.id = n.id
      where (n.validated or o.validated)
        and (n.validated is distinct from o.validated or n.starts_on <> o.starts_on or n.ends_on <> o.ends_on)) t;
  end if;
  if v_from is not null and exists (select 1 from public.v33_s2_sessions) then
    begin
      perform public.v37_s2_auto_replan(v_from, 'dates exclues modifiées');
    exception when others then
      insert into public.v33_s2_audit(action, detail) values ('auto_replan_error', jsonb_build_object('from', v_from, 'error', sqlerrm));
    end;
  end if;
  return null;
end $$;

drop trigger if exists v37_s2_excl_ins on public.v33_s2_excluded_dates;
drop trigger if exists v37_s2_excl_upd on public.v33_s2_excluded_dates;
drop trigger if exists v37_s2_excl_del on public.v33_s2_excluded_dates;
create trigger v37_s2_excl_ins after insert on public.v33_s2_excluded_dates
  referencing new table as new_rows for each statement execute function public.v37_s2_excluded_changed();
create trigger v37_s2_excl_upd after update on public.v33_s2_excluded_dates
  referencing new table as new_rows old table as old_rows for each statement execute function public.v37_s2_excluded_changed();
create trigger v37_s2_excl_del after delete on public.v33_s2_excluded_dates
  referencing old table as old_rows for each statement execute function public.v37_s2_excluded_changed();

revoke all on function public.v37_s2_compute_plan(date) from public, anon;
revoke all on function public.v37_s2_auto_replan(date, text, boolean) from public, anon;
revoke all on function public.v37_s2_excluded_changed() from public, anon, authenticated;
grant execute on function public.v37_s2_compute_plan(date) to authenticated;
grant execute on function public.v37_s2_auto_replan(date, text, boolean) to authenticated;
