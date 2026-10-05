-- Restore student SELECT visibility to the PR #23 reference behavior.
-- This reuses the existing authorization helper and does not modify student data.

drop policy if exists students_select_authorized on public.students;

create policy students_select_authorized on public.students
for select to authenticated
using (private.can_access_student(id));
