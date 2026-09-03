begin;

create table if not exists public.v515_manipulation_rooms (
  manipulation_code text primary key references public.v515_manipulations(code) on delete cascade,
  room text not null check (room in ('A','B','C','D')),
  updated_at timestamptz not null default now()
);

insert into public.v515_manipulation_rooms(manipulation_code,room) values
  ('M1','C'),('M2','B'),('M3','D'),('M4','D'),('M5','A'),('M6','A')
on conflict(manipulation_code) do update set room=excluded.room,updated_at=now();

create table if not exists public.v515_teacher_day_pool (
  cycle_id uuid not null references public.v515_cycles(id) on delete cascade,
  weekday text not null check (weekday in ('monday','thursday','friday')),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key(cycle_id,weekday,teacher_id)
);

alter table public.v515_manipulation_rooms enable row level security;
alter table public.v515_teacher_day_pool enable row level security;

grant select on public.v515_manipulation_rooms,public.v515_teacher_day_pool to authenticated;
grant insert,update,delete on public.v515_teacher_day_pool to authenticated;
revoke all on public.v515_manipulation_rooms,public.v515_teacher_day_pool from anon;

create policy v515_manipulation_rooms_read on public.v515_manipulation_rooms
for select to authenticated using ((select auth.uid()) is not null);
create policy v515_manipulation_rooms_admin on public.v515_manipulation_rooms
for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy v515_teacher_day_pool_read on public.v515_teacher_day_pool
for select to authenticated using ((select auth.uid()) is not null);
create policy v515_teacher_day_pool_admin on public.v515_teacher_day_pool
for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

create or replace function private.v515_seed_pdf_teacher_pool()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if new.academic_year='2026/2027' and new.semester=1 then
    insert into public.v515_teacher_day_pool(cycle_id,weekday,teacher_id,active)
    select new.id,v.weekday,p.id,true
    from (values
      ('monday','Khaoula Rais'),('monday','Souhail Souai'),('monday','Nadia Bouaziz'),('monday','Olfa Turki'),
      ('thursday','Khaoula Rais'),('thursday','Souhail Souai'),('thursday','Tarek Sbeouelji'),('thursday','Mouna Triki'),
      ('friday','Nadia Bouaziz'),('friday','Olfa Turki'),('friday','Tarek Sbeouelji'),('friday','Mouna Triki')
    ) v(weekday,teacher_name)
    join public.profiles p on replace(p.full_name,'Dr. ','')=v.teacher_name and p.deleted_at is null
    on conflict(cycle_id,weekday,teacher_id) do update set active=true,updated_at=now();
  end if;
  return new;
end; $$;

revoke execute on function private.v515_seed_pdf_teacher_pool() from public,anon,authenticated;
drop trigger if exists v515_seed_pdf_teacher_pool on public.v515_cycles;
create trigger v515_seed_pdf_teacher_pool after insert on public.v515_cycles
for each row execute function private.v515_seed_pdf_teacher_pool();

insert into public.v515_teacher_day_pool(cycle_id,weekday,teacher_id,active)
select c.id,v.weekday,p.id,true
from public.v515_cycles c
cross join (values
  ('monday','Khaoula Rais'),('monday','Souhail Souai'),('monday','Nadia Bouaziz'),('monday','Olfa Turki'),
  ('thursday','Khaoula Rais'),('thursday','Souhail Souai'),('thursday','Tarek Sbeouelji'),('thursday','Mouna Triki'),
  ('friday','Nadia Bouaziz'),('friday','Olfa Turki'),('friday','Tarek Sbeouelji'),('friday','Mouna Triki')
) v(weekday,teacher_name)
join public.profiles p on replace(p.full_name,'Dr. ','')=v.teacher_name and p.deleted_at is null
where c.academic_year='2026/2027' and c.semester=1
on conflict(cycle_id,weekday,teacher_id) do nothing;

create or replace function public.v515_set_teacher_day_pool(p_cycle_id uuid,p_weekday text,p_teacher_id uuid,p_active boolean)
returns jsonb language plpgsql security invoker set search_path=''
as $$
begin
  if auth.uid() is null then raise exception 'authentication required';end if;
  if not(select private.is_admin()) then return jsonb_build_object('ok',false,'code','FORBIDDEN','message','Accès Admin requis.');end if;
  if p_weekday not in ('monday','thursday','friday') then return jsonb_build_object('ok',false,'code','INVALID_WEEKDAY','message','Jour invalide.');end if;
  if not exists(select 1 from public.v515_cycles where id=p_cycle_id) then return jsonb_build_object('ok',false,'code','CYCLE_NOT_FOUND','message','Cycle introuvable.');end if;
  if not exists(select 1 from public.profiles where id=p_teacher_id and deleted_at is null) then return jsonb_build_object('ok',false,'code','TEACHER_NOT_FOUND','message','Enseignant introuvable.');end if;
  insert into public.v515_teacher_day_pool(cycle_id,weekday,teacher_id,active,updated_at)
  values(p_cycle_id,p_weekday,p_teacher_id,coalesce(p_active,true),now())
  on conflict(cycle_id,weekday,teacher_id) do update set active=excluded.active,updated_at=now();
  return jsonb_build_object('ok',true);
end; $$;
revoke execute on function public.v515_set_teacher_day_pool(uuid,text,uuid,boolean) from public,anon;
grant execute on function public.v515_set_teacher_day_pool(uuid,text,uuid,boolean) to authenticated;

create or replace function public.v515_request_assignment(p_session_id uuid,p_group_no integer,p_manipulation_code text)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare v_uid uuid:=auth.uid();v_session public.v515_sessions%rowtype;v_constraint public.v515_teacher_constraints%rowtype;v_expected text;v_count integer;v_id uuid;v_weekday text;
begin
 if v_uid is null then raise exception 'authentication required'; end if;
 select s.*,cp.weekday into v_session,v_weekday from public.v515_sessions s left join public.v515_class_pairs cp on cp.id=s.pair_id where s.id=p_session_id for share of s;
 if not found or not v_session.is_teaching_session or v_session.lifecycle_status<>'published' then return jsonb_build_object('ok',false,'code','SESSION_NOT_AVAILABLE','message','Cette séance ne peut pas recevoir de demande.'); end if;
 if not exists(select 1 from public.v515_teacher_day_pool p where p.cycle_id=v_session.cycle_id and p.weekday=v_weekday and p.teacher_id=v_uid and p.active) then return jsonb_build_object('ok',false,'code','TEACHER_NOT_ALLOWED_TODAY','message','Enseignant non autorisé sur ce jour.');end if;
 if p_group_no<1 or p_group_no>(select group_count from public.v515_cycles where id=v_session.cycle_id) then return jsonb_build_object('ok',false,'code','INVALID_GROUP','message','Groupe invalide.'); end if;
 v_expected:=public.v515_expected_manipulation(p_group_no,v_session.class_occurrence);
 if v_expected is distinct from p_manipulation_code then return jsonb_build_object('ok',false,'code','ROTATION_INCONSISTENT','message','Rotation incohérente avec le cycle M1-M6.'); end if;
 select * into v_constraint from public.v515_teacher_constraints where cycle_id=v_session.cycle_id and teacher_id=v_uid for update;
 if not found then return jsonb_build_object('ok',false,'code','TEACHER_NOT_CONFIGURED','message','Enseignant non configuré pour ce cycle.'); end if;
 if not(p_manipulation_code=any(v_constraint.allowed_manipulations)) then return jsonb_build_object('ok',false,'code','MANIPULATION_NOT_ALLOWED','message','Manipulation '||p_manipulation_code||' non autorisée pour cet enseignant.'); end if;
 select count(*) into v_count from public.v515_assignments where cycle_id=v_session.cycle_id and teacher_id=v_uid;
 if v_count>=v_constraint.quota then return jsonb_build_object('ok',false,'code','TEACHER_QUOTA','message','Quota enseignant atteint.'); end if;
 if exists(select 1 from public.v515_assignments a join public.v515_sessions s on s.id=a.session_id where a.teacher_id=v_uid and s.session_date=v_session.session_date and s.start_time<v_session.end_time and s.end_time>v_session.start_time) then return jsonb_build_object('ok',false,'code','TEACHER_TIME_CONFLICT','message','Enseignant déjà affecté sur ce créneau.'); end if;
 insert into public.v515_requests(cycle_id,session_id,group_no,manipulation_code,teacher_id,status) values(v_session.cycle_id,p_session_id,p_group_no,p_manipulation_code,v_uid,'pending') returning id into v_id;
 return jsonb_build_object('ok',true,'request_id',v_id);
exception when unique_violation then return jsonb_build_object('ok',false,'code','DUPLICATE_REQUEST','message','Une demande existe déjà pour cette séance.'); end; $$;

create or replace function public.v515_assign_teacher(p_session_id uuid,p_group_no integer,p_manipulation_code text,p_teacher_id uuid,p_room text)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare v_s public.v515_sessions%rowtype;v_c public.v515_teacher_constraints%rowtype;v_expected text;v_count integer;v_id uuid;v_fixed_room text;v_weekday text;
begin
 if auth.uid() is null then raise exception 'authentication required';end if;
 if not(select private.is_admin()) then return jsonb_build_object('ok',false,'code','FORBIDDEN','message','Accès Admin requis.');end if;
 select s.*,cp.weekday into v_s,v_weekday from public.v515_sessions s left join public.v515_class_pairs cp on cp.id=s.pair_id where s.id=p_session_id for update of s;
 if not found or not v_s.is_teaching_session or v_s.lifecycle_status not in ('published','assignments_finalized') then return jsonb_build_object('ok',false,'code','SESSION_NOT_AVAILABLE','message','Cette séance ne peut pas être attribuée.');end if;
 select room into v_fixed_room from public.v515_manipulation_rooms where manipulation_code=p_manipulation_code;
 if v_fixed_room is null or p_room is distinct from v_fixed_room then return jsonb_build_object('ok',false,'code','ROOM_NOT_ALLOWED','message','Salle imposée pour '||p_manipulation_code||' : '||coalesce(v_fixed_room,'indéfinie')||'.');end if;
 if not exists(select 1 from public.v515_teacher_day_pool p where p.cycle_id=v_s.cycle_id and p.weekday=v_weekday and p.teacher_id=p_teacher_id and p.active) then return jsonb_build_object('ok',false,'code','TEACHER_NOT_ALLOWED_TODAY','message','Enseignant non autorisé sur ce jour.');end if;
 v_expected:=public.v515_expected_manipulation(p_group_no,v_s.class_occurrence);
 if v_expected is distinct from p_manipulation_code then return jsonb_build_object('ok',false,'code','ROTATION_INCONSISTENT','message','Rotation incohérente avec le cycle M1-M6.');end if;
 select * into v_c from public.v515_teacher_constraints where cycle_id=v_s.cycle_id and teacher_id=p_teacher_id for update;
 if not found then return jsonb_build_object('ok',false,'code','TEACHER_NOT_CONFIGURED','message','Enseignant non configuré pour ce cycle.');end if;
 if not(p_manipulation_code=any(v_c.allowed_manipulations)) then return jsonb_build_object('ok',false,'code','MANIPULATION_NOT_ALLOWED','message','Manipulation '||p_manipulation_code||' non autorisée pour cet enseignant.');end if;
 perform pg_advisory_xact_lock(hashtextextended('v515-teacher|'||p_teacher_id::text||'|'||v_s.session_date::text,0));
 select count(*) into v_count from public.v515_assignments where cycle_id=v_s.cycle_id and teacher_id=p_teacher_id;
 if v_count>=v_c.quota then return jsonb_build_object('ok',false,'code','TEACHER_QUOTA','message','Quota enseignant atteint.');end if;
 if exists(select 1 from public.v515_assignments a join public.v515_sessions s on s.id=a.session_id where a.teacher_id=p_teacher_id and s.session_date=v_s.session_date and s.start_time<v_s.end_time and s.end_time>v_s.start_time) then return jsonb_build_object('ok',false,'code','TEACHER_TIME_CONFLICT','message','Enseignant déjà affecté sur ce créneau.');end if;
 insert into public.v515_assignments(cycle_id,session_id,group_no,manipulation_code,teacher_id,room,source,assigned_by) values(v_s.cycle_id,p_session_id,p_group_no,p_manipulation_code,p_teacher_id,v_fixed_room,'admin_direct',auth.uid()) returning id into v_id;
 perform private.v515_audit(v_s.cycle_id,'assignment_created',null,'Affectation créée.',jsonb_build_object('assignment_id',v_id,'teacher_id',p_teacher_id,'room',v_fixed_room));
 return jsonb_build_object('ok',true,'assignment_id',v_id);
exception when unique_violation then return jsonb_build_object('ok',false,'code','DUPLICATE_ASSIGNMENT','message','Cette séance a déjà été attribuée.'); end; $$;

revoke execute on function public.v515_request_assignment(uuid,integer,text) from public,anon;
revoke execute on function public.v515_assign_teacher(uuid,integer,text,uuid,text) from public,anon;
grant execute on function public.v515_request_assignment(uuid,integer,text),public.v515_assign_teacher(uuid,integer,text,uuid,text) to authenticated;

commit;
