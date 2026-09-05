begin;

create or replace function private.save_attendance_sheet_impl(
  p_session_id uuid,
  p_expected_revision bigint,
  p_operation_id uuid,
  p_records jsonb,
  p_justification text default null
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid:=auth.uid();
  v_admin boolean;
  v_session public.sessions%rowtype;
  v_sheet public.attendance_sheets%rowtype;
  v_existing jsonb;
  v_response jsonb;
  v_correlation uuid:=gen_random_uuid();
  v_count integer;
  v_distinct integer;
  v_record jsonb;
  v_student uuid;
  v_status text;
  v_comment text;
  v_grade numeric;
begin
  if v_actor is null then
    return jsonb_build_object('ok',false,'code','UNAUTHENTICATED','correlation_id',v_correlation);
  end if;

  select response into v_existing
  from public.operation_receipts
  where actor_id=v_actor and operation_id=p_operation_id and operation_type='save_attendance_sheet';
  if found then return v_existing; end if;

  select * into v_session
  from public.sessions
  where id=p_session_id and deleted_at is null
  for update;
  if not found then
    return jsonb_build_object('ok',false,'code','VALIDATION_ERROR','field','session_id','correlation_id',v_correlation);
  end if;

  v_admin:=private.is_admin();
  if not(v_admin or v_session.teacher_id=v_actor) then
    return jsonb_build_object('ok',false,'code','FORBIDDEN','correlation_id',v_correlation);
  end if;
  if not private.mutation_allowed() then
    return jsonb_build_object('ok',false,'code','MFA_REQUIRED','correlation_id',v_correlation);
  end if;
  if jsonb_typeof(p_records)<>'array' then
    return jsonb_build_object('ok',false,'code','VALIDATION_ERROR','field','records','correlation_id',v_correlation);
  end if;

  insert into public.attendance_sheets(id,session_id,revision,updated_by)
  values(p_session_id,p_session_id,0,v_actor)
  on conflict(session_id) do nothing;

  select * into v_sheet
  from public.attendance_sheets
  where session_id=p_session_id
  for update;

  if v_sheet.revision<>p_expected_revision then
    return jsonb_build_object('ok',false,'code','VERSION_CONFLICT','revision',v_sheet.revision,'correlation_id',v_correlation);
  end if;

  select count(*),count(distinct value->>'student_id')
  into v_count,v_distinct
  from jsonb_array_elements(p_records);
  if v_count<>v_distinct then
    return jsonb_build_object('ok',false,'code','VALIDATION_ERROR','field','duplicate_student_id','correlation_id',v_correlation);
  end if;

  for v_record in select value from jsonb_array_elements(p_records) loop
    begin v_student:=(v_record->>'student_id')::uuid;
    exception when others then
      return jsonb_build_object('ok',false,'code','VALIDATION_ERROR','field','student_id','correlation_id',v_correlation);
    end;

    v_status:=v_record->>'status';
    v_comment:=coalesce(v_record->>'comment','');
    if v_status not in('present','absent','retard','justifie') then
      return jsonb_build_object('ok',false,'code','VALIDATION_ERROR','field','status','correlation_id',v_correlation);
    end if;

    if v_record?'grade' and nullif(v_record->>'grade','') is not null then
      begin v_grade:=(v_record->>'grade')::numeric;
      exception when others then
        return jsonb_build_object('ok',false,'code','VALIDATION_ERROR','field','grade','correlation_id',v_correlation);
      end;
      if v_grade<0 or v_grade>20 then
        return jsonb_build_object('ok',false,'code','VALIDATION_ERROR','field','grade','correlation_id',v_correlation);
      end if;
    else
      v_grade:=null;
    end if;

    if not exists(
      select 1 from public.students s
      where s.id=v_student and s.class_id=v_session.class_id and s.deleted_at is null
    ) then
      return jsonb_build_object('ok',false,'code','VALIDATION_ERROR','field','student_membership','correlation_id',v_correlation);
    end if;

    if v_session.completed_at is not null and not v_admin then
      if exists(
        select 1 from public.attendance a
        where a.session_id=p_session_id and a.student_id=v_student and a.deleted_at is null
      ) then
        update public.attendance
           set grade=v_grade,
               grade_updated_at=case when v_grade is distinct from grade then now() else grade_updated_at end,
               attendance_sheet_id=v_sheet.id,
               updated_by=v_actor
         where session_id=p_session_id
           and student_id=v_student
           and deleted_at is null;
      elsif v_grade is not null then
        insert into public.attendance(
          teacher_id,session_id,student_id,status,comment,grade,grade_updated_at,
          attendance_sheet_id,updated_by,grade_only
        ) values(
          v_session.teacher_id,p_session_id,v_student,'present','',v_grade,now(),
          v_sheet.id,v_actor,true
        );
      end if;
    else
      insert into public.attendance(
        teacher_id,session_id,student_id,status,comment,grade,grade_updated_at,attendance_sheet_id,updated_by
      ) values(
        v_session.teacher_id,p_session_id,v_student,v_status,v_comment,v_grade,
        case when v_grade is null then null else now() end,v_sheet.id,v_actor
      )
      on conflict(session_id,student_id) do update
      set status=excluded.status,
          comment=excluded.comment,
          grade=excluded.grade,
          grade_updated_at=case when excluded.grade is distinct from public.attendance.grade then now() else public.attendance.grade_updated_at end,
          attendance_sheet_id=v_sheet.id,
          updated_by=v_actor;
    end if;
  end loop;

  update public.attendance_sheets
  set revision=revision+1,updated_at=now(),updated_by=v_actor
  where id=v_sheet.id
  returning * into v_sheet;

  v_response:=private.get_attendance_sheet_impl(p_session_id)
    ||jsonb_build_object('operation_id',p_operation_id,'correlation_id',v_correlation);

  insert into public.audit_logs(
    actor_id,action,entity_type,entity_id,correlation_id,before_state,after_state,justification
  ) values(
    v_actor,'attendance.sheet.saved','attendance_sheet',v_sheet.id,v_correlation,
    jsonb_build_object('revision',p_expected_revision),v_response,nullif(trim(p_justification),'')
  );

  insert into public.operation_receipts(actor_id,operation_id,operation_type,correlation_id,response)
  values(v_actor,p_operation_id,'save_attendance_sheet',v_correlation,v_response);

  return v_response;
exception when others then
  return jsonb_build_object('ok',false,'code','INTERNAL_ERROR','correlation_id',v_correlation);
end;
$$;

commit;
