-- Fix PostgREST INSERT ... RETURNING for students under RLS.
-- The former SELECT policy called private.can_access_student(id), which
-- re-queried public.students during the same INSERT command. The newly
-- inserted row is not visible to that nested SELECT at that point, so
-- PostgREST requests using ?select=id were rolled back with SQLSTATE 42501.
--
-- Keep the same authorization semantics, but evaluate access directly from
-- the row currently being checked. LPC3 remains owner-only.

drop policy if exists students_select_authorized on public.students;

create policy students_select_authorized on public.students
for select to authenticated
using (
  exists(
    select 1
    from public.classes c
    where c.id = students.class_id
      and c.deleted_at is null
      and (
        (c.module = 'TP Ondes et Vibrations' and private.is_lpc3_owner())
        or
        (
          c.module is distinct from 'TP Ondes et Vibrations'
          and (
            private.is_admin()
            or students.teacher_id = (select auth.uid())
            or exists(
              select 1
              from public.session_plans sp
              where sp.class_id = students.class_id
                and sp.teacher_id = (select auth.uid())
                and sp.deleted_at is null
            )
            or exists(
              select 1
              from public.sessions se
              where se.class_id = students.class_id
                and se.teacher_id = (select auth.uid())
                and se.deleted_at is null
            )
          )
        )
      )
  )
);
