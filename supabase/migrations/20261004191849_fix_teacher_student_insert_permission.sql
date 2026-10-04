-- Allow authenticated teachers to add students to MPI1-PC1 groups they are
-- actually assigned to, even when the legacy students.teacher_id value points
-- to the historical class owner. Identity updates/deletes remain admin-only.
-- LPC3 access remains restricted to the institutional owner.

drop policy if exists students_insert_authorized on public.students;

create policy students_insert_authorized on public.students
for insert to authenticated
with check (
  private.mutation_allowed()
  and exists(
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
            current_user_is_admin()
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
