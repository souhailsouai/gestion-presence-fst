-- V43b — Fonctions du planning S2 par espace (paramètre p_space, MPI1 · PC1 par défaut).

drop function if exists public.v37_s2_auto_replan(date, text, boolean);
drop function if exists public.v37_s2_compute_plan(date);
drop function if exists public.v33_s2_replace_plan(date, jsonb, text);
drop function if exists public.v33_s2_save_version(text);

create function public.v37_s2_compute_plan(p_from date, p_space uuid default '00000000-0000-4000-8000-000000000001')
returns jsonb language plpgsql stable security definer set search_path to '' as $function$
declare
  v_sd date; v_ed date; v_gc int; v_mc int; v_start date; v_from date; v_end date;
  pk record; cls text[]; n int; v_weekday int; v_mode text;
  done jsonb; taken date[]; last_cls text; turn int; d date; pick int; i int; c text; occ int;
  sessions jsonb := '[]'::jsonb; warnings jsonb := '[]'::jsonb; slots jsonb; g int; v_code text; v_teacher uuid; v_room text;
  all_done boolean;
begin
  if not private.can_read_space(p_space) then raise exception 'Espace non autorisé'; end if;
  select start_date, end_date, group_count, manip_count into v_sd, v_ed, v_gc, v_mc from public.v33_s2_settings where space_id = p_space;
  v_gc := coalesce(v_gc, 5); v_mc := coalesce(v_mc, 5);
  v_start := greatest(coalesce(v_sd, date '2027-01-11'), date '2027-01-11');
  v_from := greatest(coalesce(p_from, v_start), v_start);
  v_end := coalesce(v_ed, v_start + 210);
  for pk in
    select pair_key, array_agg(class_name order by pair_order, class_name) as names,
           min(weekday) as wd, max(weekday) as wd2, (array_agg(mode order by pair_order, class_name))[1] as mode
    from public.v33_s2_class_slots where active and space_id = p_space group by pair_key order by pair_key
  loop
    cls := pk.names; n := array_length(cls, 1); v_weekday := pk.wd; v_mode := coalesce(pk.mode, 'alternance');
    if pk.wd <> pk.wd2 then warnings := warnings || to_jsonb('Paire « ' || pk.pair_key || ' » : les classes n''ont pas le même jour.'); end if;
    done := '{}'::jsonb;
    foreach c in array cls loop
      done := done || jsonb_build_object(c, (select count(*) from public.v33_s2_sessions s where s.space_id = p_space and s.class_name = c and (s.locked or s.session_date < v_from)));
    end loop;
    select coalesce(array_agg(s.session_date), '{}') into taken from public.v33_s2_sessions s
      where s.space_id = p_space and s.class_name = any(cls) and (s.locked or s.session_date < v_from);
    select s.class_name into last_cls from public.v33_s2_sessions s
      where s.space_id = p_space and s.class_name = any(cls) and (s.locked or s.session_date < v_from) and s.session_date < v_from
      order by s.session_date desc, s.class_name desc limit 1;
    turn := case when last_cls is null then 0 else array_position(cls, last_cls) % n end;
    d := v_from; while extract(isodow from d)::int <> v_weekday loop d := d + 1; end loop;
    while d <= v_end loop
      all_done := true;
      foreach c in array cls loop if (done->>c)::int < v_mc then all_done := false; end if; end loop;
      exit when all_done;
      if not exists (select 1 from public.v33_s2_excluded_dates x where x.space_id = p_space and x.validated and d between x.starts_on and x.ends_on)
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
            where s.space_id = p_space and s.manipulation_code = v_code and s.weekday = v_weekday;
          if coalesce(v_room, '') = '' then select m.room into v_room from public.v33_s2_manipulations m where m.space_id = p_space and m.code = v_code; end if;
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
end $function$;

create function public.v33_s2_replace_plan(p_from date, p_sessions jsonb, p_reason text default null, p_space uuid default '00000000-0000-4000-8000-000000000001')
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_deleted int; v_inserted int := 0; s jsonb; g jsonb; v_id uuid;
begin
  if not private.can_admin_space(p_space) then raise exception 'Réservé à l''administrateur de l''espace'; end if;
  if p_from is null or p_from < '2027-01-11' then p_from := '2027-01-11'; end if;
  delete from public.v33_s2_sessions where space_id = p_space and session_date >= p_from and not locked;
  get diagnostics v_deleted = row_count;
  for s in select * from jsonb_array_elements(coalesce(p_sessions,'[]'::jsonb)) loop
    if (s->>'session_date')::date < p_from then continue; end if;
    if not exists (select 1 from public.v33_s2_class_slots cs where cs.class_name = s->>'class_name' and cs.space_id = p_space) then continue; end if;
    if exists (select 1 from public.v33_s2_sessions x where x.class_name = s->>'class_name' and x.session_date = (s->>'session_date')::date) then continue; end if;
    insert into public.v33_s2_sessions(space_id, class_name, session_date, start_time, end_time, occurrence, note)
      values (p_space, s->>'class_name', (s->>'session_date')::date, (s->>'start_time')::time, (s->>'end_time')::time, (s->>'occurrence')::int, s->>'note')
      returning id into v_id;
    for g in select * from jsonb_array_elements(coalesce(s->'slots','[]'::jsonb)) loop
      insert into public.v33_s2_slots(space_id, session_id, group_no, manipulation_code, teacher_id, room)
        values (p_space, v_id, (g->>'group_no')::int, g->>'manipulation_code', nullif(g->>'teacher_id','')::uuid, g->>'room');
    end loop;
    v_inserted := v_inserted + 1;
  end loop;
  insert into public.v33_s2_audit(space_id, action, detail) values (p_space, 'replace_plan', jsonb_build_object('from', p_from, 'deleted', v_deleted, 'inserted', v_inserted, 'reason', p_reason));
  return jsonb_build_object('deleted', v_deleted, 'inserted', v_inserted);
end $function$;

create function public.v33_s2_save_version(p_label text, p_space uuid default '00000000-0000-4000-8000-000000000001')
returns uuid language plpgsql security definer set search_path to '' as $function$
declare v_id uuid;
begin
  if not private.can_admin_space(p_space) then raise exception 'Réservé à l''administrateur de l''espace'; end if;
  insert into public.v33_s2_versions(space_id, label, snapshot, created_by)
  select p_space, p_label, jsonb_build_object(
    'sessions', coalesce((select jsonb_agg(to_jsonb(s) order by s.session_date, s.class_name) from public.v33_s2_sessions s where s.space_id = p_space), '[]'::jsonb),
    'slots', coalesce((select jsonb_agg(to_jsonb(g)) from public.v33_s2_slots g where g.space_id = p_space), '[]'::jsonb)), auth.uid()
  returning id into v_id;
  insert into public.v33_s2_audit(space_id, action, detail) values (p_space, 'save_version', jsonb_build_object('id', v_id, 'label', p_label));
  return v_id;
end $function$;

create or replace function public.v33_s2_restore_version(p_id uuid)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v jsonb; n int; v_space uuid;
begin
  select snapshot, space_id into v, v_space from public.v33_s2_versions where id = p_id;
  if v is null then raise exception 'Version introuvable'; end if;
  if not private.can_admin_space(v_space) then raise exception 'Réservé à l''administrateur de l''espace'; end if;
  delete from public.v33_s2_sessions where space_id = v_space;
  -- Les anciennes versions (avant V43) n'ont pas de space_id : la valeur par défaut de la colonne s'applique.
  insert into public.v33_s2_sessions select * from jsonb_populate_recordset(null::public.v33_s2_sessions,
    (select coalesce(jsonb_agg(e || jsonb_build_object('space_id', v_space)), '[]'::jsonb) from jsonb_array_elements(v->'sessions') e));
  get diagnostics n = row_count;
  insert into public.v33_s2_slots select * from jsonb_populate_recordset(null::public.v33_s2_slots,
    (select coalesce(jsonb_agg(e || jsonb_build_object('space_id', v_space)), '[]'::jsonb) from jsonb_array_elements(v->'slots') e));
  insert into public.v33_s2_audit(space_id, action, detail) values (v_space, 'restore_version', jsonb_build_object('id', p_id, 'sessions', n));
  return jsonb_build_object('sessions', n);
end $function$;

create function public.v37_s2_auto_replan(p_from date, p_reason text default 'recalcul automatique', p_force boolean default false,
  p_space uuid default '00000000-0000-4000-8000-000000000001')
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v_from date; plan jsonb; res jsonb;
begin
  if not private.can_admin_space(p_space) then raise exception 'Réservé à l''administrateur de l''espace'; end if;
  if not p_force and not exists (select 1 from public.v33_s2_sessions where space_id = p_space) then
    return jsonb_build_object('skipped', true, 'reason', 'aucun planning généré');
  end if;
  v_from := greatest(coalesce(p_from, date '2027-01-11'), current_date, date '2027-01-11');
  plan := public.v37_s2_compute_plan(v_from, p_space);
  if exists (select 1 from public.v33_s2_sessions where space_id = p_space) then
    perform public.v33_s2_save_version(left('Sauvegarde avant ' || coalesce(p_reason, 'recalcul') || ' du ' || to_char(v_from, 'DD/MM/YYYY'), 120), p_space);
  end if;
  res := public.v33_s2_replace_plan(v_from, plan->'sessions', p_reason, p_space);
  return res || jsonb_build_object('from', v_from, 'warnings', plan->'warnings');
end $function$;

create or replace function public.v37_s2_excluded_changed()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare r record; q text;
begin
  -- Chaque déclencheur ne voit que ses propres tables de transition : la requête est choisie selon l'opération.
  if tg_op = 'INSERT' then q := 'select space_id, min(starts_on) as v_from from new_rows where validated group by space_id';
  elsif tg_op = 'DELETE' then q := 'select space_id, min(starts_on) as v_from from old_rows where validated group by space_id';
  else q := 'select n.space_id, min(least(n.starts_on, o.starts_on)) as v_from from new_rows n join old_rows o on o.id = n.id
             where (n.validated or o.validated) and (n.validated is distinct from o.validated or n.starts_on <> o.starts_on or n.ends_on <> o.ends_on)
             group by n.space_id';
  end if;
  for r in execute q loop
    if r.v_from is not null and exists (select 1 from public.v33_s2_sessions where space_id = r.space_id) then
      begin
        perform public.v37_s2_auto_replan(r.v_from, 'dates exclues modifiées', false, r.space_id);
      exception when others then
        insert into public.v33_s2_audit(space_id, action, detail) values (r.space_id, 'auto_replan_error', jsonb_build_object('from', r.v_from, 'error', sqlerrm));
      end;
    end if;
  end loop;
  return null;
end $function$;

revoke all on function public.v37_s2_compute_plan(date, uuid), public.v33_s2_replace_plan(date, jsonb, text, uuid),
  public.v33_s2_save_version(text, uuid), public.v37_s2_auto_replan(date, text, boolean, uuid) from public, anon;
grant execute on function public.v37_s2_compute_plan(date, uuid), public.v33_s2_replace_plan(date, jsonb, text, uuid),
  public.v33_s2_save_version(text, uuid), public.v37_s2_auto_replan(date, text, boolean, uuid), public.v33_s2_restore_version(uuid) to authenticated;
