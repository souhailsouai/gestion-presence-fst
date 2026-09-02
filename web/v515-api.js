(function(){
'use strict';
const messages={
  FORBIDDEN:'Vous ne disposez pas des droits requis.',UNAUTHENTICATED:'Votre session a expiré.',
  QUOTA_REACHED:'Quota enseignant atteint.',MANIPULATION_NOT_ALLOWED:'Manipulation non autorisée pour cet enseignant.',
  TEACHER_OVERLAP:'Enseignant déjà affecté sur ce créneau.',POSITION_ALREADY_ASSIGNED:'Cette séance est déjà attribuée.',
  TEACHER_INACTIVE:'Enseignant inactif.',CYCLE_NOT_DRAFT:'Le cycle doit être en brouillon.',
  ROSTER_MAPPING_INCOMPLETE:'La configuration des groupes est incomplète.'
};
async function rpc(name,args){
  const result=await supabaseClient.rpc(name,args);
  if(result.error){
    const raw=result.error.message||name;
    const code=Object.keys(messages).find(k=>raw.includes(k))||result.error.code||'RPC_ERROR';
    const e=new Error(messages[code]||raw);e.code=code;e.cause=result.error;throw e;
  }
  return result.data;
}
const api={
  rpc,
  dashboard:()=>rpc('v515_my_dashboard'),
  availablePositions:()=>rpc('v515_available_positions'),
  myRequests:()=>rpc('v515_my_requests'),
  myAssignments:()=>rpc('v515_my_assignments'),
  adminBootstrap:()=>rpc('v515_admin_bootstrap'),
  adminSnapshot:cycleId=>rpc('v515_admin_snapshot',{p_cycle_id:cycleId}),
  submitRequest:positionId=>rpc('v515_submit_request',{p_position_id:positionId}),
  cancelRequest:requestId=>rpc('v515_cancel_request',{p_request_id:requestId}),
  acceptRequest:requestId=>rpc('v515_accept_request',{p_request_id:requestId}),
  rejectRequest:requestId=>rpc('v515_reject_request',{p_request_id:requestId}),
  directAssign:(positionId,teacherId)=>rpc('v515_direct_assign',{p_position_id:positionId,p_teacher_id:teacherId}),
  generateCycle:cycleId=>rpc('v515_generate_cycle',{p_cycle_id:cycleId}),
  openCycle:cycleId=>rpc('v515_open_cycle',{p_cycle_id:cycleId}),
  resetCycle:cycleId=>rpc('v515_reset_cycle',{p_cycle_id:cycleId}),
  verifyCycle:cycleId=>rpc('v515_verify_cycle',{p_cycle_id:cycleId}),
  finalizeCycle:cycleId=>rpc('v515_finalize_cycle',{p_cycle_id:cycleId}),
  cancelPosition:positionId=>rpc('v515_cancel_position',{p_position_id:positionId}),
  createCatchup:(positionId,date,start,end,room)=>rpc('v515_create_catchup',{p_position_id:positionId,p_date:date,p_start:start,p_end:end,p_room:room}),
  setRotationException:(positionId,manipulation)=>rpc('v515_set_rotation_exception',{p_position_id:positionId,p_manipulation_code:manipulation}),
  setTeacherConfig:(teacherId,quota,active,manipulations)=>rpc('v515_set_teacher_config',{p_teacher_id:teacherId,p_quota:quota,p_active:active,p_manipulations:manipulations}),
  upsertCycle:x=>rpc('v515_upsert_cycle',{p_cycle_id:x.id||null,p_academic_year_id:x.academicYearId,p_name:x.name,p_start_date:x.startDate,p_end_date:x.endDate,p_week_a_anchor_date:x.weekAAnchorDate}),
  upsertClassConfig:x=>rpc('v515_upsert_class_config',{p_class_config_id:x.id||null,p_cycle_id:x.cycleId,p_class_key:x.classKey,p_track:x.track||null,p_class_number:x.classNumber??null,p_display_name:x.displayName,p_group_count:x.groupCount,p_active:x.active!==false}),
  setGroupRoster:(classConfigId,groupNo,legacyClassId,studentGroupId=null)=>rpc('v515_set_group_roster',{p_class_config_id:classConfigId,p_group_no:groupNo,p_legacy_class_id:legacyClassId,p_student_group_id:studentGroupId}),
  createRosterGroup:(classConfigId,groupNo)=>rpc('v515_create_roster_group',{p_class_config_id:classConfigId,p_group_no:groupNo}),
  upsertTimeslot:x=>rpc('v515_upsert_timeslot',{p_timeslot_id:x.id||null,p_day_of_week:x.dayOfWeek,p_start:x.start,p_end:x.end,p_room:x.room||null,p_active:x.active!==false}),
  setFortnightPair:(cycleId,timeslotId,weekAClassId,weekBClassId)=>rpc('v515_set_fortnight_pair',{p_cycle_id:cycleId,p_timeslot_id:timeslotId,p_week_a_class_config_id:weekAClassId,p_week_b_class_config_id:weekBClassId})
};
window.FSTV515Api=api;
})();
