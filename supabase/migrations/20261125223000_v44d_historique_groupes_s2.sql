-- V44d — L'appel S2 ne réécrit plus l'histoire : quand un étudiant change de groupe au S2 (MPI1 · PC1),
-- le changement est daté dans v16_student_group_memberships à la date de la séance S2. Le bilan S1 place
-- chaque étudiant d'après ses séances du S1, pas d'après sa liste actuelle.
create or replace function public.v44_s2_start_slot(p_slot_id uuid) returns uuid
language plpgsql security definer set search_path to '' as $$
declare
  v_slot public.v33_s2_slots%rowtype; v_ses public.v33_s2_sessions%rowtype;
  v_teacher uuid; v_st uuid; v_name text; v_class uuid; v_module text; v_session uuid;
begin
  if auth.uid() is null or not private.mutation_allowed() then raise exception 'Connexion requise'; end if;
  select * into v_slot from public.v33_s2_slots where id = p_slot_id for update;
  if not found then raise exception 'Case du planning introuvable'; end if;
  select * into v_ses from public.v33_s2_sessions where id = v_slot.session_id;
  -- Seul l'enseignant de la case, ou un administrateur de l'espace, ouvre l'appel.
  if v_slot.teacher_id is distinct from auth.uid() and not private.can_admin_space(v_slot.space_id) then
    raise exception 'Cette case n''est pas attribuée à votre compte';
  end if;
  if v_slot.attendance_session_id is not null and exists (select 1 from public.sessions s where s.id = v_slot.attendance_session_id and s.deleted_at is null) then
    return v_slot.attendance_session_id;
  end if;
  v_teacher := coalesce(v_slot.teacher_id, auth.uid());
  v_name := v_ses.class_name || '-G' || v_slot.group_no;
  -- Liste du groupe dans l'espace (créée si besoin)
  select c.id into v_class from public.classes c where c.name = v_name and c.space_id = v_slot.space_id and c.deleted_at is null limit 1;
  if v_class is null then
    select c.module into v_module from public.classes c where c.space_id = v_slot.space_id and c.deleted_at is null
      and (c.name = v_ses.class_name or c.name like v_ses.class_name || '-G%') limit 1;
    insert into public.classes(teacher_id, name, module, space_id, group_number, updated_by)
      values (v_teacher, v_name, coalesce(v_module, 'TP Physique S2'), v_slot.space_id, v_slot.group_no, auth.uid())
      returning id into v_class;
  end if;
  -- Les étudiants actifs du groupe S2 rejoignent la liste du groupe (leurs présences passées sont conservées).
  for v_st in select st.id from public.students st
     where st.deleted_at is null and st.class_id is distinct from v_class
       and st.id in (select m.student_id from public.v33_s2_group_members m
                      where m.space_id = v_slot.space_id and m.class_name = v_ses.class_name and m.group_no = v_slot.group_no and m.status = 'actif')
  loop
    -- MPI1 · PC1 : le changement est daté dans l'historique (comme v16_set_student_group) ; le groupe du S1 reste lisible.
    if v_slot.space_id = private.default_space() then
      perform pg_advisory_xact_lock(hashtextextended('v16-student-membership|'||v_st::text,0));
      if exists (select 1 from public.v16_student_group_memberships where student_id = v_st and effective_from = v_ses.session_date) then
        update public.v16_student_group_memberships set class_id = v_class, group_no = v_slot.group_no, active = true, changed_by = auth.uid(), updated_at = now()
         where student_id = v_st and effective_from = v_ses.session_date;
      else
        update public.v16_student_group_memberships set effective_to = v_ses.session_date, active = false, changed_by = auth.uid(), updated_at = now()
         where student_id = v_st and effective_from < v_ses.session_date and (effective_to is null or effective_to > v_ses.session_date);
        insert into public.v16_student_group_memberships(student_id, class_id, group_no, effective_from, effective_to, active, changed_by)
          values (v_st, v_class, v_slot.group_no, v_ses.session_date,
                  (select min(effective_from) from public.v16_student_group_memberships where student_id = v_st and effective_from > v_ses.session_date), true, auth.uid());
      end if;
    end if;
    update public.students set class_id = v_class, updated_at = now(), updated_by = auth.uid() where id = v_st;
  end loop;
  -- Même séance déjà créée à la main pour ce groupe et cette date : on la réutilise.
  select s.id into v_session from public.sessions s where s.class_id = v_class and s.session_date = v_ses.session_date and s.deleted_at is null limit 1;
  if v_session is null then
    insert into public.sessions(teacher_id, class_id, session_date, start_time, end_time, updated_by)
      values (v_teacher, v_class, v_ses.session_date, v_ses.start_time, v_ses.end_time, auth.uid())
      returning id into v_session;
  end if;
  update public.v33_s2_slots set attendance_session_id = v_session where id = v_slot.id;
  insert into public.v33_s2_audit(space_id, action, detail)
    values (v_slot.space_id, 'start_attendance', jsonb_build_object('slot', v_slot.id, 'session', v_session, 'class', v_name, 'date', v_ses.session_date));
  return v_session;
end $$;
