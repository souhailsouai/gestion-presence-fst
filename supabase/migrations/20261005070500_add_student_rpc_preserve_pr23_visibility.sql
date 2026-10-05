-- Preserve PR #23 student SELECT visibility while providing a safe insert path.
-- The RPC performs authorization before inserting and returns only the supplied id.

create or replace function public.v31_add_student_authorized(
  p_student_id uuid,
  p_class_id uuid,
  p_last_name text,
  p_first_name text,
  p_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_module text;
begin
  if v_uid is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if not private.mutation_allowed() then
    raise exception 'MUTATION_NOT_ALLOWED' using errcode = '42501';
  end if;

  if nullif(btrim(p_last_name),'') is null or nullif(btrim(p_first_name),'') is null then
    raise exception 'STUDENT_NAME_REQUIRED' using errcode = '22023';
  end if;

  select c.module into v_module
  from public.classes c
  where c.id = p_class_id
    and c.deleted_at is null;

  if v_module is null then
    raise exception 'CLASS_NOT_FOUND' using errcode = '22023';
  end if;

  if v_module = 'TP Ondes et Vibrations' then
    if not private.is_lpc3_owner() then
      raise exception 'LPC3_FORBIDDEN' using errcode = '42501';
    end if;
  else
    if not (
      public.current_user_is_admin()
      or exists(
        select 1
        from public.session_plans sp
        where sp.class_id = p_class_id
          and sp.teacher_id = v_uid
          and sp.deleted_at is null
      )
      or exists(
        select 1
        from public.sessions se
        where se.class_id = p_class_id
          and se.teacher_id = v_uid
          and se.deleted_at is null
      )
    ) then
      raise exception 'STUDENT_INSERT_FORBIDDEN' using errcode = '42501';
    end if;
  end if;

  insert into public.students(
    id, teacher_id, class_id, last_name, first_name, email
  )
  values(
    p_student_id,
    v_uid,
    p_class_id,
    btrim(p_last_name),
    btrim(p_first_name),
    nullif(btrim(coalesce(p_email,'')),'')
  );

  return p_student_id;
end;
$function$;

revoke all on function public.v31_add_student_authorized(uuid,uuid,text,text,text) from public, anon;
grant execute on function public.v31_add_student_authorized(uuid,uuid,text,text,text) to authenticated;
