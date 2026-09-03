begin;

create or replace function public.v16_students_for_session(
  p_session_id uuid,
  p_context text default 'real'
)
returns table(
  student_id uuid,
  class_id uuid,
  group_no integer,
  last_name text,
  first_name text,
  email text,
  effective_from date,
  effective_to date
)
language plpgsql
security invoker
set search_path=''
as $$
declare
  s public.v515_sessions%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_context not in ('real','test') then raise exception 'INVALID_CONTEXT'; end if;
  if p_context='test' then raise exception 'TEST_CONTEXT_NOT_READY'; end if;

  select * into s from public.v515_sessions where id=p_session_id;
  if not found then raise exception 'SESSION_NOT_FOUND'; end if;

  if not(select private.is_admin()) and not exists(
    select 1 from public.v515_assignments a
    where a.session_id=p_session_id and a.teacher_id=auth.uid()
  ) then
    raise exception 'FORBIDDEN';
  end if;

  return query
  select
    st.id as student_id,
    m.class_id,
    m.group_no,
    st.last_name::text,
    st.first_name::text,
    st.email::text,
    m.effective_from,
    m.effective_to
  from public.v16_student_group_memberships m
  join public.students st on st.id=m.student_id
  join public.classes c on c.id=m.class_id
  where c.name=s.class_name
    and m.effective_from<=s.session_date
    and (m.effective_to is null or s.session_date<m.effective_to)
  order by m.group_no,st.last_name,st.first_name;
end;
$$;

revoke execute on function public.v16_students_for_session(uuid,text) from public,anon;
grant execute on function public.v16_students_for_session(uuid,text) to authenticated;

commit;
