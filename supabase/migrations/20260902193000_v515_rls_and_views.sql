-- V5.15 RLS and authoritative read models.

alter table public.v515_cycles enable row level security;
alter table public.v515_class_config enable row level security;
alter table public.v515_group_rosters enable row level security;
alter table public.v515_timeslots enable row level security;
alter table public.v515_fortnight_pairs enable row level security;
alter table public.v515_rotation enable row level security;
alter table public.v515_teacher_config enable row level security;
alter table public.v515_teacher_manipulations enable row level security;
alter table public.v515_session_positions enable row level security;
alter table public.v515_requests enable row level security;
alter table public.v515_assignments enable row level security;
alter table public.v515_audit_log enable row level security;

-- Admin-only direct reads for configuration tables; teacher reads use RPCs.
do $$
declare t text;
begin
  foreach t in array array[
    'v515_cycles','v515_class_config','v515_group_rosters','v515_timeslots',
    'v515_fortnight_pairs','v515_rotation','v515_session_positions','v515_audit_log'
  ] loop
    execute format('drop policy if exists %I on public.%I','v515_admin_select_'||t,t);
    execute format('create policy %I on public.%I for select to authenticated using (public.current_user_is_admin())','v515_admin_select_'||t,t);
  end loop;
end $$;

drop policy if exists v515_teacher_config_select on public.v515_teacher_config;
create policy v515_teacher_config_select on public.v515_teacher_config
for select to authenticated
using (teacher_id=auth.uid() or public.current_user_is_admin());

drop policy if exists v515_teacher_manipulations_select on public.v515_teacher_manipulations;
create policy v515_teacher_manipulations_select on public.v515_teacher_manipulations
for select to authenticated
using (teacher_id=auth.uid() or public.current_user_is_admin());

drop policy if exists v515_requests_select on public.v515_requests;
create policy v515_requests_select on public.v515_requests
for select to authenticated
using (teacher_id=auth.uid() or public.current_user_is_admin());

drop policy if exists v515_assignments_select on public.v515_assignments;
create policy v515_assignments_select on public.v515_assignments
for select to authenticated
using (teacher_id=auth.uid() or public.current_user_is_admin());

create or replace function public.v515_available_positions()
returns table(
  position_id uuid,
  cycle_id uuid,
  class_key text,
  class_name text,
  session_date date,
  start_time time,
  end_time time,
  group_no smallint,
  manipulation_code text,
  room text,
  fortnight_week text,
  my_request_id uuid,
  my_request_status text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.id,p.cycle_id,cc.class_key,cc.display_name,p.session_date,p.start_time,p.end_time,
         p.group_no,p.manipulation_code,p.room,p.fortnight_week,r.id,r.status
  from public.v515_session_positions p
  join public.v515_class_config cc on cc.id=p.class_config_id
  join public.v515_cycles c on c.id=p.cycle_id and c.status in ('OPEN_FOR_REQUESTS','ASSIGNMENT')
  join public.v515_teacher_config tc on tc.teacher_id=auth.uid() and tc.active
  join public.v515_teacher_manipulations tm on tm.teacher_id=tc.teacher_id and tm.manipulation_code=p.manipulation_code
  left join public.v515_requests r on r.position_id=p.id and r.teacher_id=auth.uid()
  where auth.uid() is not null
    and p.status='OPEN'
  order by p.session_date,p.start_time,cc.display_name,p.group_no;
$$;

create or replace function public.v515_my_requests()
returns table(
  request_id uuid, position_id uuid, status text, requested_at timestamptz,
  class_name text, session_date date, start_time time, end_time time,
  group_no smallint, manipulation_code text, room text, fortnight_week text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select r.id,p.id,r.status,r.created_at,cc.display_name,p.session_date,p.start_time,p.end_time,
         p.group_no,p.manipulation_code,p.room,p.fortnight_week
  from public.v515_requests r
  join public.v515_session_positions p on p.id=r.position_id
  join public.v515_class_config cc on cc.id=p.class_config_id
  where auth.uid() is not null and r.teacher_id=auth.uid()
  order by r.created_at desc;
$$;

create or replace function public.v515_my_assignments()
returns table(
  assignment_id uuid, position_id uuid, assigned_at timestamptz,
  class_name text, session_date date, start_time time, end_time time,
  group_no smallint, manipulation_code text, room text, fortnight_week text, position_status text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select a.id,p.id,a.assigned_at,cc.display_name,p.session_date,p.start_time,p.end_time,
         p.group_no,p.manipulation_code,p.room,p.fortnight_week,p.status
  from public.v515_assignments a
  join public.v515_session_positions p on p.id=a.position_id
  join public.v515_class_config cc on cc.id=p.class_config_id
  where auth.uid() is not null and a.teacher_id=auth.uid()
  order by p.session_date,p.start_time;
$$;

create or replace function public.v515_my_dashboard()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case when auth.uid() is null then jsonb_build_object('ok',false,'code','UNAUTHENTICATED') else
    jsonb_build_object(
      'ok',true,
      'quota_total',coalesce(tc.quota,0),
      'validated_count',(select count(*) from public.v515_assignments a where a.teacher_id=auth.uid()),
      'pending_count',(select count(*) from public.v515_requests r where r.teacher_id=auth.uid() and r.status='PENDING'),
      'remaining_quota',greatest(coalesce(tc.quota,0)-(select count(*) from public.v515_assignments a where a.teacher_id=auth.uid()),0),
      'active',coalesce(tc.active,false),
      'allowed_manipulations',coalesce((select jsonb_agg(tm.manipulation_code order by tm.manipulation_code) from public.v515_teacher_manipulations tm where tm.teacher_id=auth.uid()),'[]'::jsonb),
      'upcoming_assignments',coalesce((
        select jsonb_agg(jsonb_build_object(
          'assignment_id',a.id,'position_id',p.id,'class_name',cc.display_name,
          'date',p.session_date,'start_time',p.start_time,'end_time',p.end_time,
          'group_no',p.group_no,'manipulation_code',p.manipulation_code,'room',p.room,'status',p.status
        ) order by p.session_date,p.start_time)
        from public.v515_assignments a
        join public.v515_session_positions p on p.id=a.position_id
        join public.v515_class_config cc on cc.id=p.class_config_id
        where a.teacher_id=auth.uid() and p.session_date>=current_date and p.status<>'CANCELLED'
      ),'[]'::jsonb)
    ) end
  from (select 1) x
  left join public.v515_teacher_config tc on tc.teacher_id=auth.uid();
$$;

create or replace function public.v515_admin_snapshot(p_cycle_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare result jsonb;
begin
  if auth.uid() is null or not public.current_user_is_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  select jsonb_build_object(
    'ok',true,
    'cycle',(select to_jsonb(c) from public.v515_cycles c where c.id=p_cycle_id),
    'classes',coalesce((select jsonb_agg(to_jsonb(cc) order by cc.display_name) from public.v515_class_config cc where cc.cycle_id=p_cycle_id),'[]'::jsonb),
    'rosters',coalesce((select jsonb_agg(to_jsonb(gr) order by cc.display_name,gr.group_no) from public.v515_group_rosters gr join public.v515_class_config cc on cc.id=gr.class_config_id where cc.cycle_id=p_cycle_id),'[]'::jsonb),
    'timeslots',coalesce((select jsonb_agg(to_jsonb(ts) order by ts.day_of_week,ts.start_time) from public.v515_timeslots ts where exists(select 1 from public.v515_fortnight_pairs fp where fp.cycle_id=p_cycle_id and fp.timeslot_id=ts.id)),'[]'::jsonb),
    'pairs',coalesce((select jsonb_agg(to_jsonb(fp)) from public.v515_fortnight_pairs fp where fp.cycle_id=p_cycle_id),'[]'::jsonb),
    'positions',coalesce((select jsonb_agg(jsonb_build_object(
      'position_id',p.id,'class_config_id',p.class_config_id,'class_name',cc.display_name,'date',p.session_date,
      'start_time',p.start_time,'end_time',p.end_time,'group_no',p.group_no,'manipulation_code',p.manipulation_code,
      'room',p.room,'fortnight_week',p.fortnight_week,'status',p.status,
      'assignment_teacher_id',a.teacher_id,
      'pending_candidates',(select count(*) from public.v515_requests r where r.position_id=p.id and r.status='PENDING')
    ) order by p.session_date,p.start_time,cc.display_name,p.group_no)
      from public.v515_session_positions p
      join public.v515_class_config cc on cc.id=p.class_config_id
      left join public.v515_assignments a on a.position_id=p.id
      where p.cycle_id=p_cycle_id),'[]'::jsonb),
    'teachers',coalesce((select jsonb_agg(jsonb_build_object(
      'teacher_id',pr.id,'teacher_name',pr.full_name,'active',tc.active,'quota',tc.quota,
      'validated_count',(select count(*) from public.v515_assignments a where a.teacher_id=pr.id),
      'pending_count',(select count(*) from public.v515_requests r where r.teacher_id=pr.id and r.status='PENDING'),
      'remaining_quota',greatest(tc.quota-(select count(*) from public.v515_assignments a where a.teacher_id=pr.id),0),
      'manipulations',coalesce((select jsonb_agg(tm.manipulation_code order by tm.manipulation_code) from public.v515_teacher_manipulations tm where tm.teacher_id=pr.id),'[]'::jsonb)
    ) order by pr.full_name) from public.v515_teacher_config tc join public.profiles pr on pr.id=tc.teacher_id),'[]'::jsonb),
    'requests',coalesce((select jsonb_agg(jsonb_build_object(
      'request_id',r.id,'position_id',r.position_id,'teacher_id',r.teacher_id,'teacher_name',pr.full_name,'status',r.status,'created_at',r.created_at
    ) order by r.created_at) from public.v515_requests r join public.v515_session_positions p on p.id=r.position_id join public.profiles pr on pr.id=r.teacher_id where p.cycle_id=p_cycle_id),'[]'::jsonb),
    'uncovered_count',(select count(*) from public.v515_session_positions p where p.cycle_id=p_cycle_id and p.status in ('OPEN','DRAFT') and not exists(select 1 from public.v515_assignments a where a.position_id=p.id))
  ) into result;
  return result;
end;
$$;

create or replace function public.v515_visible_students()
returns table(
  id uuid, teacher_id uuid, class_id uuid, last_name text, first_name text, email text, created_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select distinct s.id,s.teacher_id,s.class_id,s.last_name,s.first_name,s.email,s.created_at
  from public.v515_assignments a
  join public.v515_session_positions p on p.id=a.position_id and p.status in ('FINALIZED','REALIZED')
  join public.v515_group_rosters gr on gr.id=p.roster_id
  join public.students s on s.class_id=gr.legacy_class_id and s.deleted_at is null
  where auth.uid() is not null and a.teacher_id=auth.uid();
$$;

revoke all on function public.v515_available_positions() from public, anon;
revoke all on function public.v515_my_requests() from public, anon;
revoke all on function public.v515_my_assignments() from public, anon;
revoke all on function public.v515_my_dashboard() from public, anon;
revoke all on function public.v515_admin_snapshot(uuid) from public, anon;
revoke all on function public.v515_visible_students() from public, anon;
grant execute on function public.v515_available_positions() to authenticated;
grant execute on function public.v515_my_requests() to authenticated;
grant execute on function public.v515_my_assignments() to authenticated;
grant execute on function public.v515_my_dashboard() to authenticated;
grant execute on function public.v515_admin_snapshot(uuid) to authenticated;
grant execute on function public.v515_visible_students() to authenticated;

create or replace function public.v515_admin_bootstrap()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare result jsonb;
begin
  if auth.uid() is null or not public.current_user_is_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if;
  select jsonb_build_object(
    'ok',true,
    'academic_years',coalesce((
      select jsonb_agg(jsonb_build_object('id',a.id,'code',a.code,'starts_on',a.starts_on,'ends_on',a.ends_on,'is_active',a.is_active) order by a.is_active desc,a.code desc)
      from public.academic_years a where a.archived_at is null
    ),'[]'::jsonb),
    'class_families',coalesce((
      select jsonb_agg(jsonb_build_object('class_key',x.class_key,'display_name',x.display_name,'track',x.track,'class_number',x.class_number,'existing_groups',x.existing_groups) order by x.track,x.class_number)
      from (
        select c.track,c.class_number,
               coalesce(c.track,'')||':'||coalesce(c.class_number::text,regexp_replace(c.name,'-G[1-6]$','')) class_key,
               min(regexp_replace(c.name,'-G[1-6]$','')) display_name,
               jsonb_agg(distinct c.group_number order by c.group_number) filter(where c.group_number is not null) existing_groups
        from public.classes c
        where c.deleted_at is null and c.module='TP Physique'
        group by c.track,c.class_number
      ) x
    ),'[]'::jsonb),
    'legacy_classes',coalesce((
      select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'track',c.track,'class_number',c.class_number,'group_number',c.group_number,'room',c.room) order by c.track,c.class_number,c.group_number,c.name)
      from public.classes c where c.deleted_at is null and c.module='TP Physique'
    ),'[]'::jsonb),
    'student_groups',coalesce((
      select jsonb_agg(jsonb_build_object('id',g.id,'academic_year_id',g.academic_year_id,'display_name',g.display_name,'track',g.track,'class_number',g.class_number,'group_number',g.group_number) order by g.track,g.class_number,g.group_number)
      from public.student_groups g where g.deleted_at is null
    ),'[]'::jsonb),
    'teachers',coalesce((
      select jsonb_agg(jsonb_build_object('teacher_id',p.id,'teacher_name',p.full_name,'email',p.email,'role',p.role,'account_state',p.account_state) order by p.full_name)
      from public.profiles p where p.deleted_at is null and p.role in ('teacher','admin')
    ),'[]'::jsonb),
    'cycles',coalesce((
      select jsonb_agg(to_jsonb(c) order by c.created_at desc) from public.v515_cycles c
    ),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;

revoke all on function public.v515_admin_bootstrap() from public, anon;
grant execute on function public.v515_admin_bootstrap() to authenticated;
