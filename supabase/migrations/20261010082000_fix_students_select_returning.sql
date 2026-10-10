-- Make INSERT ... RETURNING compatible with the existing student visibility model.
-- This preserves the PR #23 visibility semantics but evaluates them directly
-- against the row instead of re-querying public.students by id.

drop policy if exists students_select_authorized on public.students;

create policy students_select_authorized
on public.students
for select
to authenticated
using (
  students.deleted_at is null
  and exists (
    select 1
    from public.classes c
    where c.id = students.class_id
      and (
        (
          c.module = 'TP Ondes et Vibrations'
          and private.is_lpc3_owner()
        )
        or
        (
          c.module is distinct from 'TP Ondes et Vibrations'
          and (
            private.is_admin()
            or students.teacher_id = (select auth.uid())
            or exists (
              select 1
              from public.session_plans sp
              where sp.class_id = students.class_id
                and sp.teacher_id = (select auth.uid())
                and sp.deleted_at is null
            )
            or exists (
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
