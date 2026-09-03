begin;

create or replace function public.v515_materialize_session_plans(p_cycle_id uuid)
returns jsonb language plpgsql security invoker set search_path=''
as $$
declare v_year uuid;v_missing text;v_started integer;v_count integer;v_a record;v_class uuid;v_plan uuid;begin
 if auth.uid() is null or not private.mutation_allowed() then raise exception 'authentication required';end if;
 if not(select private.is_admin()) then return jsonb_build_object('ok',false,'code','FORBIDDEN','message','Accès Admin requis.');end if;
 perform 1 from public.v515_cycles where id=p_cycle_id and status='assignments_finalized' for update;
 if not found then return jsonb_build_object('ok',false,'code','INVALID_CYCLE_STATE','message','Les affectations doivent être finalisées avant l’activation dans présence.');end if;
 select ay.id into v_year from public.academic_years ay join public.v515_cycles c on c.id=p_cycle_id and c.academic_year=ay.code where ay.archived_at is null limit 1;
 if v_year is null then return jsonb_build_object('ok',false,'code','ACADEMIC_YEAR_MISSING','message','Année universitaire introuvable.');end if;
 select string_agg(x.target_name,', ' order by x.target_name) into v_missing from (select distinct s.class_name||'-G'||a.group_no target_name from public.v515_assignments a join public.v515_sessions s on s.id=a.session_id left join public.classes c on c.name=s.class_name||'-G'||a.group_no and c.deleted_at is null where a.cycle_id=p_cycle_id and c.id is null)x;
 if v_missing is not null then return jsonb_build_object('ok',false,'code','LEGACY_CLASS_MISSING','message','Classes/groupes manquants pour présence : '||v_missing||'.');end if;
 select count(*) into v_started from public.session_plans sp join public.classes c on c.id=sp.class_id where sp.plan_date in(select session_date from public.v515_sessions where cycle_id=p_cycle_id) and c.name ~ '^(MPI1-(A|B|C|D|E)|PC1-A)-G[1-6]$' and sp.session_id is not null and sp.deleted_at is null;
 if v_started>0 then return jsonb_build_object('ok',false,'code','LEGACY_PLAN_STARTED','message','Activation impossible : '||v_started||' séance(s) existante(s) ont déjà été démarrées.');end if;

 -- Replace only unstarted legacy plans on dates explicitly present in the approved V5.15 calendar.
 -- This removes obsolete holiday/rest entries without touching history or unrelated rattrapage dates.
 update public.session_plans sp set deleted_at=now(),revision=revision+1,updated_at=now(),updated_by=auth.uid()
 from public.classes c where c.id=sp.class_id and sp.plan_date in(select session_date from public.v515_sessions where cycle_id=p_cycle_id) and c.name ~ '^(MPI1-(A|B|C|D|E)|PC1-A)-G[1-6]$' and sp.session_id is null;

 for v_a in select a.id assignment_id,a.teacher_id,a.room,a.group_no,a.manipulation_code,s.class_name,s.session_date,s.start_time,s.end_time from public.v515_assignments a join public.v515_sessions s on s.id=a.session_id where a.cycle_id=p_cycle_id order by s.session_date,s.class_name,a.group_no loop
   select id into v_class from public.classes where name=v_a.class_name||'-G'||v_a.group_no and deleted_at is null limit 1;
   insert into public.session_plans(academic_year_id,class_id,teacher_id,plan_date,start_time,end_time,module,manipulation,status,room,plan_kind,revision,updated_by,deleted_at)
   values(v_year,v_class,v_a.teacher_id,v_a.session_date,v_a.start_time,v_a.end_time,'TP Physique',v_a.manipulation_code,'planned',v_a.room,'regular',1,auth.uid(),null)
   on conflict(class_id,plan_date) do update set teacher_id=excluded.teacher_id,start_time=excluded.start_time,end_time=excluded.end_time,module=excluded.module,manipulation=excluded.manipulation,status='planned',room=excluded.room,plan_kind='regular',deleted_at=null,revision=public.session_plans.revision+1,updated_at=now(),updated_by=auth.uid()
   where public.session_plans.session_id is null
   returning id into v_plan;
   if v_plan is null then raise exception 'existing session plan already started for % on %',v_a.class_name||'-G'||v_a.group_no,v_a.session_date;end if;
   update public.v515_assignments set legacy_plan_id=v_plan where id=v_a.assignment_id;
 end loop;
 select count(*) into v_count from public.v515_assignments where cycle_id=p_cycle_id and legacy_plan_id is not null;
 perform private.v515_audit(p_cycle_id,'legacy_plans_materialized',null,'Planning V5.15 activé dans le module présence.',jsonb_build_object('plans',v_count));
 return jsonb_build_object('ok',true,'plans',v_count);
end; $$;

revoke execute on function public.v515_materialize_session_plans(uuid) from public,anon;
grant execute on function public.v515_materialize_session_plans(uuid) to authenticated;

commit;
