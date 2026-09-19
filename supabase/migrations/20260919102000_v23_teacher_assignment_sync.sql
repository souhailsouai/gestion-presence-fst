-- V23 bounded synchronization for teacher/day/manipulation assignments.
-- Requires exactly 18 official assignments: M1..M6 for Monday, Thursday and Friday.
-- Existing opened/linked sessions are preserved because v21_save_teacher_configuration
-- only regenerates plans with session_id IS NULL.

create or replace function public.v23_save_teacher_configuration(p_rows jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $function$
declare
  v_result jsonb;
  v_cycle uuid;
  v_count integer;
  v_exact integer;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok',false,'code','AUTH_REQUIRED');
  end if;

  if not (select private.is_admin()) then
    return jsonb_build_object('ok',false,'code','FORBIDDEN','message','Accès Admin requis.');
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) <> 18 then
    return jsonb_build_object(
      'ok',false,
      'code','INCOMPLETE_CONFIGURATION',
      'message','La configuration doit contenir exactement 18 affectations : M1 à M6 pour lundi, jeudi et vendredi.'
    );
  end if;

  create temporary table cfg_v23(
    teacher_id uuid,
    day_of_week smallint,
    manipulation_code text
  ) on commit drop;

  insert into cfg_v23
  select x.teacher_id, x.day_of_week, x.manipulation_code
  from jsonb_to_recordset(p_rows)
    x(teacher_id uuid, day_of_week smallint, manipulation_code text);

  if (select count(*) from cfg_v23) <> 18 then
    return jsonb_build_object('ok',false,'code','INCOMPLETE_CONFIGURATION','message','18 affectations sont requises.');
  end if;

  if exists(
    select 1
    from cfg_v23
    where teacher_id is null
       or day_of_week not in (1,4,5)
       or manipulation_code not in ('M1','M2','M3','M4','M5','M6')
  ) then
    return jsonb_build_object('ok',false,'code','INVALID_ROW');
  end if;

  if exists(
    select 1 from cfg_v23
    group by teacher_id, day_of_week
    having count(*) > 1
  ) then
    return jsonb_build_object(
      'ok',false,'code','DUPLICATE_TEACHER_DAY',
      'message','Un enseignant ne peut avoir qu’une manipulation par jour.'
    );
  end if;

  if exists(
    select 1 from cfg_v23
    group by day_of_week, manipulation_code
    having count(*) > 1
  ) then
    return jsonb_build_object(
      'ok',false,'code','DUPLICATE_DAY_MANIP',
      'message','Chaque manipulation M1 à M6 doit être affectée une seule fois par jour.'
    );
  end if;

  if exists(
    select 1
    from (values (1),(4),(5)) d(day_of_week)
    where (select count(*) from cfg_v23 c where c.day_of_week=d.day_of_week) <> 6
       or (select count(distinct manipulation_code) from cfg_v23 c where c.day_of_week=d.day_of_week) <> 6
  ) then
    return jsonb_build_object(
      'ok',false,'code','INCOMPLETE_DAY',
      'message','Chaque jour doit contenir exactement M1 à M6.'
    );
  end if;

  v_result := public.v21_save_teacher_configuration(p_rows);

  if not coalesce((v_result->>'ok')::boolean,false) then
    return v_result;
  end if;

  select id into v_cycle
  from public.v515_cycles
  where academic_year='2026/2027' and semester=1
  limit 1;

  select count(*) into v_count
  from public.v21_teacher_day_manipulations
  where cycle_id=v_cycle and active=true;

  select count(*) into v_exact
  from cfg_v23 c
  join public.v21_teacher_day_manipulations m
    on m.cycle_id=v_cycle
   and m.active=true
   and m.teacher_id=c.teacher_id
   and m.day_of_week=c.day_of_week
   and m.manipulation_code=c.manipulation_code;

  if v_count <> 18 or v_exact <> 18 then
    raise exception
      'V23 teacher configuration synchronization failed: saved %, exact %',
      v_count, v_exact;
  end if;

  return v_result || jsonb_build_object(
    'ok',true,
    'configured_rows',18,
    'verified_rows',18,
    'message','Configuration complète — 18/18 affectations enregistrées et synchronisées.'
  );
end;
$function$;

revoke execute on function public.v23_save_teacher_configuration(jsonb) from public;
revoke execute on function public.v23_save_teacher_configuration(jsonb) from anon;
grant execute on function public.v23_save_teacher_configuration(jsonb) to authenticated;
