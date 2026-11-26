-- V52 — Nombre de groupes (= nombre de manipulations) réglable par classe : 4, 5 ou 6.
-- Vide = valeurs de l'espace (v33_s2_settings.group_count / manip_count), comme avant.
-- Aucune donnée existante n'est modifiée.
alter table public.v33_s2_class_slots
  add column if not exists group_count smallint
  check (group_count is null or group_count between 4 and 6);
comment on column public.v33_s2_class_slots.group_count is
  'Groupes de la classe au S2 (4, 5 ou 6) ; autant de manipulations (M1…Mn) pour une rotation complète. NULL = réglage de l''espace.';

-- Planning automatique : chaque classe fait autant de séances qu'elle a de manipulations,
-- avec autant de groupes. L'heure de la classe est lue dans son propre espace.
create or replace function public.v37_s2_compute_plan(p_from date, p_space uuid default '00000000-0000-4000-8000-000000000001'::uuid)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
declare
  v_sd date; v_ed date; v_gc int; v_mc int; v_start date; v_from date; v_end date;
  pk record; cls text[]; n int; v_weekday int; v_mode text;
  done jsonb; need jsonb; taken date[]; last_cls text; turn int; d date; pick int; i int; c text; occ int; k int;
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
    done := '{}'::jsonb; need := '{}'::jsonb;
    foreach c in array cls loop
      done := done || jsonb_build_object(c, (select count(*) from public.v33_s2_sessions s where s.space_id = p_space and s.class_name = c and (s.locked or s.session_date < v_from)));
      -- [groupes, manipulations] de la classe : son réglage (groupes = manipulations), sinon celui de l'espace.
      need := need || jsonb_build_object(c, (select case when cs.group_count is not null then jsonb_build_array(cs.group_count, cs.group_count)
                                                         else jsonb_build_array(v_gc, v_mc) end
                                             from public.v33_s2_class_slots cs where cs.space_id = p_space and cs.class_name = c));
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
      foreach c in array cls loop if (done->>c)::int < (need->c->>1)::int then all_done := false; end if; end loop;
      exit when all_done;
      if not exists (select 1 from public.v33_s2_excluded_dates x where x.space_id = p_space and x.validated and d between x.starts_on and x.ends_on)
         and not (d = any(taken)) then
        pick := null;
        if v_mode = 'bloc' then
          for i in 1..n loop if (done->>cls[i])::int < (need->cls[i]->>1)::int then pick := i; exit; end if; end loop;
        else
          for i in 0..n-1 loop
            if (done->>cls[((turn + i) % n) + 1])::int < (need->cls[((turn + i) % n) + 1]->>1)::int then
              pick := ((turn + i) % n) + 1; turn := (turn + i + 1) % n; exit;
            end if;
          end loop;
        end if;
        exit when pick is null;
        occ := (done->>cls[pick])::int + 1; done := done || jsonb_build_object(cls[pick], occ);
        k := (need->cls[pick]->>1)::int;
        slots := '[]'::jsonb;
        for g in 1..(need->cls[pick]->>0)::int loop
          v_code := 'M' || (((g - 1) + (occ - 1)) % k + 1);
          v_teacher := null; v_room := null;
          select s.teacher_id, s.room into v_teacher, v_room from public.v33_s2_stations s
            where s.space_id = p_space and s.manipulation_code = v_code and s.weekday = v_weekday;
          if coalesce(v_room, '') = '' then select m.room into v_room from public.v33_s2_manipulations m where m.space_id = p_space and m.code = v_code; end if;
          slots := slots || jsonb_build_object('group_no', g, 'manipulation_code', v_code, 'teacher_id', v_teacher, 'room', coalesce(v_room, ''));
        end loop;
        sessions := sessions || jsonb_build_object(
          'class_name', cls[pick], 'session_date', d,
          'start_time', (select to_char(cs.start_time, 'HH24:MI') from public.v33_s2_class_slots cs where cs.space_id = p_space and cs.class_name = cls[pick]),
          'end_time', (select to_char(cs.end_time, 'HH24:MI') from public.v33_s2_class_slots cs where cs.space_id = p_space and cs.class_name = cls[pick]),
          'occurrence', occ, 'slots', slots);
      end if;
      d := d + 7;
    end loop;
    foreach c in array cls loop
      if (done->>c)::int < (need->c->>1)::int then
        warnings := warnings || to_jsonb(c || ' : seulement ' || (done->>c) || ' séance(s) sur ' || (need->c->>1) || ' avant le ' || to_char(v_end, 'DD/MM/YYYY') || '.');
      end if;
    end loop;
  end loop;
  return jsonb_build_object('from', v_from, 'sessions',
    coalesce((select jsonb_agg(e order by e->>'session_date', e->>'class_name') from jsonb_array_elements(sessions) e), '[]'::jsonb),
    'warnings', warnings);
end $function$;
