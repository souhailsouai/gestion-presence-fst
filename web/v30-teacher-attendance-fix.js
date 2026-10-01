(function(root){
'use strict';

function teacher(){
  try{return typeof currentTeacher!=='undefined'?currentTeacher:(root.currentTeacher||null);}
  catch(_){return root.currentTeacher||null;}
}
function runtimeData(){
  try{return typeof data!=='undefined'?data:(root.data||{classes:[],students:[],sessions:[],attendance:[]});}
  catch(_){return root.data||{classes:[],students:[],sessions:[],attendance:[]};}
}
function client(){
  try{return typeof supabaseClient!=='undefined'?supabaseClient:(root.supabaseClient||null);}
  catch(_){return root.supabaseClient||null;}
}
function sessionById(id){return (runtimeData().sessions||[]).find(s=>String(s.id)===String(id));}
function studentsFor(session){return (runtimeData().students||[]).filter(st=>String(st.classId)===String(session?.classId));}
function attendanceFor(sessionId,studentId){return (runtimeData().attendance||[]).find(a=>String(a.sessionId)===String(sessionId)&&String(a.studentId)===String(studentId));}
function assignedToCurrentTeacher(session){
  const t=teacher(); if(!t||!session)return false;
  if(Boolean(t.isAdmin))return true;
  if(String(session.teacherId||'')===String(t.id||''))return true;
  try{return root.V22TeacherAttendanceAccess?.canEditSession?.(session)===true;}catch(_){return false;}
}
function materialize(session){
  const d=runtimeData(),t=teacher();
  for(const st of studentsFor(session)){
    let a=attendanceFor(session.id,st.id);
    if(!a){
      a={
        id:crypto.randomUUID(),
        teacherId:session.teacherId||t?.id||'',
        sessionId:session.id,
        studentId:st.id,
        status:'present',
        comment:'',
        grade:null,
        gradeUpdatedAt:null,
        gradeOnly:false,
        timestamp:new Date().toISOString()
      };
      d.attendance.push(a);
    }
    if(!a.status)a.status='present';
    a.gradeOnly=false;
  }
}
async function saveAttendanceFixed(showSuccess=true){
  const t=teacher(),c=client(),d=runtimeData();
  if(!t||!c)return false;
  const sid=root.document?.getElementById('presence-session')?.value||'';
  if(!sid){root.showAlert?.('Sélectionnez une séance.','danger');return false;}
  const s=sessionById(sid);
  if(!assignedToCurrentTeacher(s)){root.showAlert?.('Cette séance est en lecture seule.','danger');return false;}
  materialize(s);
  const rows=(d.attendance||[])
    .filter(a=>String(a.sessionId)===String(sid)&&!a.gradeOnly)
    .map(a=>({
      id:String(a.id),
      teacher_id:a.teacherId||s.teacherId||t.id,
      session_id:String(a.sessionId),
      student_id:String(a.studentId),
      status:a.status||'present',
      comment:a.comment||'',
      grade:a.grade==null?null:Number(a.grade),
      grade_updated_at:a.gradeUpdatedAt||null,
      grade_only:false
    }));
  if(!rows.length){root.showAlert?.('Aucun étudiant n’est associé à cette séance.','danger');return false;}
  const {error}=await c.from('attendance').upsert(rows,{onConflict:'session_id,student_id'});
  if(error){root.showAlert?.('Enregistrement impossible : '+error.message,'danger');return false;}
  await root.FSTOnlineRuntime?.refreshAuthoritativeState?.();
  if(showSuccess)root.showAlert?.('Présences et absences enregistrées avec succès','success');
  return true;
}

function install(){
  root.saveAttendance=saveAttendanceFixed;
  if(root.FSTSessionEditing)root.FSTSessionEditing.saveAttendance=saveAttendanceFixed;
  root.V30TeacherAttendanceFix={saveAttendance:saveAttendanceFixed,assignedToCurrentTeacher,materialize};
}

if(root.document?.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>setTimeout(install,0));
else setTimeout(install,0);
})(window);
