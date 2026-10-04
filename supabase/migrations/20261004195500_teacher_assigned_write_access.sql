-- Teachers may edit attendance/grades for sessions explicitly assigned to them
-- by the official session plan, while preserving the strict LPC3 owner boundary.
create or replace function private.can_access_session(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists(
    select 1
    from public.sessions s
    join public.classes c on c.id=s.class_id
    where s.id=p_session_id
      and s.deleted_at is null
      and (
        (c.module='TP Ondes et Vibrations' and private.is_lpc3_owner())
        or
        (c.module is distinct from 'TP Ondes et Vibrations' and (
          private.is_admin()
          or s.teacher_id=(select auth.uid())
          or exists(
            select 1
            from public.session_plans sp
            where sp.deleted_at is null
              and sp.teacher_id=(select auth.uid())
              and (
                sp.session_id=s.id
                or (
                  sp.session_id is null
                  and sp.class_id=s.class_id
                  and sp.plan_date=s.session_date
                )
              )
          )
        ))
      )
  );
$function$;
