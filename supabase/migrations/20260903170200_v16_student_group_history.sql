begin;

create extension if not exists btree_gist with schema extensions;

create table public.v16_student_group_memberships (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete restrict,
  group_no integer not null check(group_no between 1 and 4),
  effective_from date not null,
  effective_to date,
  active boolean not null default true,
  changed_by uuid not null default auth.uid() references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(effective_to is null or effective_to>effective_from),
  constraint v16_student_memberships_no_overlap
    exclude using gist (
      student_id with =,
      daterange(effective_from,coalesce(effective_to,'infinity'::date),'[)') with &&
    )
);

create index v16_student_memberships_student_date_idx
  on public.v16_student_group_memberships(student_id,effective_from,effective_to);
create index v16_student_memberships_class_group_idx
  on public.v16_student_group_memberships(class_id,group_no,effective_from);

alter table public.v16_student_group_memberships enable row level security;
grant select,insert,update,delete on public.v16_student_group_memberships to authenticated;

create policy v16_student_memberships_read
  on public.v16_student_group_memberships
  for select to authenticated
  using((select auth.uid()) is not null);

create policy v16_student_memberships_admin_insert
  on public.v16_student_group_memberships
  for insert to authenticated
  with check((select private.is_admin()));

create policy v16_student_memberships_admin_update
  on public.v16_student_group_memberships
  for update to authenticated
  using((select private.is_admin()))
  with check((select private.is_admin()));

create policy v16_student_memberships_admin_delete
  on public.v16_student_group_memberships
  for delete to authenticated
  using((select private.is_admin()));

create or replace function public.v16_set_student_group(
  p_student_id uuid,
  p_class_id uuid,
  p_group_no integer,
  p_effective_from date
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_cycle_id uuid;
  v_existing public.v16_student_group_memberships%rowtype;
  v_next_from date;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not(select private.is_admin()) then
    return jsonb_build_object('ok',false,'code','FORBIDDEN','message','Accès Admin requis.');
  end if;
  if p_group_no not between 1 and 4 then
    return jsonb_build_object('ok',false,'code','INVALID_GROUP','message','Le groupe doit être compris entre G1 et G4.');
  end if;
  if p_effective_from is null then
    return jsonb_build_object('ok',false,'code','INVALID_EFFECTIVE_DATE','message','Date d’effet obligatoire.');
  end if;
  if not exists(select 1 from public.students s where s.id=p_student_id) then
    return jsonb_build_object('ok',false,'code','STUDENT_NOT_FOUND','message','Étudiant introuvable.');
  end if;
  if not exists(select 1 from public.classes c where c.id=p_class_id) then
    return jsonb_build_object('ok',false,'code','CLASS_NOT_FOUND','message','Classe/groupe introuvable.');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('v16-student-membership|'||p_student_id::text,0));

  select * into v_existing
  from public.v16_student_group_memberships m
  where m.student_id=p_student_id and m.effective_from=p_effective_from
  for update;

  select min(m.effective_from) into v_next_from
  from public.v16_student_group_memberships m
  where m.student_id=p_student_id and m.effective_from>p_effective_from;

  if v_existing.id is not null then
    update public.v16_student_group_memberships
       set class_id=p_class_id,
           group_no=p_group_no,
           changed_by=auth.uid(),
           active=true,
           updated_at=now()
     where id=v_existing.id
     returning id into v_id;
  else
    update public.v16_student_group_memberships
       set effective_to=p_effective_from,
           active=false,
           changed_by=auth.uid(),
           updated_at=now()
     where student_id=p_student_id
       and effective_from<p_effective_from
       and (effective_to is null or effective_to>p_effective_from);

    insert into public.v16_student_group_memberships(
      student_id,class_id,group_no,effective_from,effective_to,active,changed_by
    ) values(
      p_student_id,p_class_id,p_group_no,p_effective_from,v_next_from,true,auth.uid()
    ) returning id into v_id;
  end if;

  select c.id into v_cycle_id
  from public.v515_cycles c
  where c.academic_year='2026/2027' and c.semester=1
  limit 1;

  perform private.v515_audit(
    v_cycle_id,
    'v16_student_group_changed',
    null,
    'Affectation de groupe étudiant modifiée avec date d’effet.',
    jsonb_build_object('student_id',p_student_id,'class_id',p_class_id,'group_no',p_group_no,'effective_from',p_effective_from,'membership_id',v_id,'changed_by',auth.uid())
  );

  return jsonb_build_object('ok',true,'membership_id',v_id,'student_id',p_student_id,'group_no',p_group_no,'effective_from',p_effective_from);
exception
  when exclusion_violation then
    return jsonb_build_object('ok',false,'code','MEMBERSHIP_OVERLAP','message','Cette affectation chevauche une période existante.');
end;
$$;

create or replace function public.v16_end_student_membership(
  p_student_id uuid,
  p_effective_to date
)
returns jsonb
language plpgsql
security invoker
set search_path=''
as $$
declare
  v_cycle_id uuid;
  v_membership public.v16_student_group_memberships%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not(select private.is_admin()) then
    return jsonb_build_object('ok',false,'code','FORBIDDEN','message','Accès Admin requis.');
  end if;
  if p_effective_to is null then
    return jsonb_build_object('ok',false,'code','INVALID_EFFECTIVE_DATE','message','Date d’effet obligatoire.');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('v16-student-membership|'||p_student_id::text,0));

  select * into v_membership
  from public.v16_student_group_memberships m
  where m.student_id=p_student_id
    and m.effective_from<p_effective_to
    and (m.effective_to is null or p_effective_to<m.effective_to)
  order by m.effective_from desc
  limit 1
  for update;

  if v_membership.id is null then
    return jsonb_build_object('ok',false,'code','MEMBERSHIP_NOT_FOUND','message','Aucune affectation active à cette date.');
  end if;

  update public.v16_student_group_memberships
     set effective_to=p_effective_to,
         active=false,
         changed_by=auth.uid(),
         updated_at=now()
   where id=v_membership.id;

  select c.id into v_cycle_id
  from public.v515_cycles c
  where c.academic_year='2026/2027' and c.semester=1
  limit 1;

  perform private.v515_audit(
    v_cycle_id,
    'v16_student_membership_ended',
    null,
    'Affectation de groupe étudiant terminée avec date d’effet.',
    jsonb_build_object('student_id',p_student_id,'membership_id',v_membership.id,'effective_to',p_effective_to,'changed_by',auth.uid())
  );

  return jsonb_build_object('ok',true,'student_id',p_student_id,'membership_id',v_membership.id,'effective_to',p_effective_to);
end;
$$;

revoke execute on function public.v16_set_student_group(uuid,uuid,integer,date) from public,anon;
grant execute on function public.v16_set_student_group(uuid,uuid,integer,date) to authenticated;
revoke execute on function public.v16_end_student_membership(uuid,date) from public,anon;
grant execute on function public.v16_end_student_membership(uuid,date) to authenticated;

commit;
