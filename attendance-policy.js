(function(){
  'use strict';
  function acl(){return window.FSTAccessControl;}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function sessionById(id){return (data.sessions||[]).find(s=>String(s.id)===String(id));}
  function classById(id){return (data.classes||[]).find(c=>String(c.id)===String(id));}
  window.fetchRemoteData=async function(){
    if(!currentTeacher)return{classes:[],students:[],sessions:[],attendance:[]};
    const isAdmin=acl()?.isAdmin?.()===true;
    const classQ=supabaseClient.from('classes').select('*');
    const sessionQ=supabaseClient.from('sessions').select('*');
    // Do not filter students by teacher_id here. RLS already restricts rows to groups
    // assigned to the authenticated teacher; filtering by owner hides valid students
    // when a group/student was created or reassigned by another authorized account.
    const studentQ=supabaseClient.from('students').select('*');
    const attendanceQ=isAdmin?supabaseClient.from('attendance').select('*'):supabaseClient.from('attendance').select('*').eq('teacher_id',currentTeacher.id);
    const [c,st,se,a]=await Promise.all([classQ,studentQ,sessionQ,attendanceQ,acl()?.refreshTeacherNames?.()]);
    const err=c.error||st.error||se.error||a.error;if(err)throw err;
    const mapped={
      classes:(c.data||[]).map(x=>({id:x.id,teacherId:x.teacher_id,name:x.name,track:x.track||'',classNumber:x.class_number||null,groupNumber:x.group_number||null,module:x.module,day:x.day||'',start:(x.start_time||'').slice(0,5),end:(x.end_time||'').slice(0,5),room:x.room||'',createdAt:x.created_at})),
      students:(st.data||[]).map(x=>({id:x.id,teacherId:x.teacher_id,lastname:x.last_name,firstname:x.first_name,email:x.email||'',classId:x.class_id,createdAt:x.created_at})),
      sessions:(se.data||[]).map(x=>({id:x.id,teacherId:x.teacher_id,date:x.session_date,start:(x.start_time||'').slice(0,5),end:(x.end_time||'').slice(0,5),classId:x.class_id,completedAt:x.completed_at||null,createdAt:x.created_at})),
      attendance:(a.data||[]).map(x=>({id:x.id,teacherId:x.teacher_id,sessionId:x.session_id,studentId:x.student_id,status:x.status,comment:x.comment||'',grade:x.grade==null?null:Number(x.grade),gradeUpdatedAt:x.grade_updated_at||null,gradeOnly:Boolean(x.grade_only),timestamp:x.updated_at}))
    };
    const foreign=mapped.sessions.filter(s=>!acl()?.canManageRecord?.(s));if(acl())acl().foreignSessions=foreign;
    return mapped;
  };
  window.saveAttendance=async function(showSuccess=true){
    const sid=document.getElementById('presence-session')?.value||'',s=sessionById(sid);if(!acl()?.canManageRecord?.(s)){showAlert('Cette séance est en lecture seule.','danger');return false;}
    const rows=(data.attendance||[]).filter(a=>String(a.sessionId)===String(sid)).map(a=>({id:String(a.id),teacher_id:a.teacherId||s.teacherId||currentTeacher.id,session_id:String(a.sessionId),student_id:String(a.studentId),status:a.status||'present',comment:a.comment||'',grade:a.grade==null?null:Number(a.grade),grade_updated_at:a.gradeUpdatedAt||null,grade_only:Boolean(a.gradeOnly)}));
    if(rows.length){const {error}=await supabaseClient.from('attendance').upsert(rows);if(error){showAlert('Enregistrement impossible : '+error.message,'danger');return false;}}
    await window.FSTOnlineRuntime?.refreshAuthoritativeState();if(showSuccess)showAlert('Enregistrement effectué','success');return true;
  };
  window.renderSessions=function(){
    const list=document.getElementById('sessions-list');if(!list)return;list.innerHTML='';
    [...(data.sessions||[])].sort((a,b)=>new Date(b.date)-new Date(a.date)).forEach(session=>{const cls=classById(session.classId),card=document.createElement('div');card.className='student-item';card.dataset.sessionDate=session.date;if(acl()?.canManageRecord?.(session)){const count=(data.attendance||[]).filter(a=>String(a.sessionId)===String(session.id)&&!a.gradeOnly).length;card.innerHTML=`<div><strong>${esc(cls?.name||'Classe supprimée')}</strong><br><small>${esc(session.date)} | ${esc(session.start)} - ${esc(session.end)}</small></div><div><span class="badge badge-info">${count} pointages</span> ${session.completedAt?'<span class="badge badge-present">Terminée</span>':''} <button class="btn btn-sm btn-info" onclick="openSessionForNotes('${esc(session.id)}')"><i class="fas fa-pen"></i> Notes</button> <button class="btn btn-sm btn-primary" onclick="generateSessionReport('${esc(session.id)}');switchTabProgrammatically('rapports')"><i class="fas fa-file-alt"></i> Rapport</button> <button class="btn btn-sm btn-danger" onclick="deleteSession('${esc(session.id)}')"><i class="fas fa-trash"></i></button></div>`;}else{const label=cls?.classNumber?`${cls.track||''}${cls.classNumber}`:(cls?.name||'—');card.innerHTML=`<div><strong>${esc(acl()?.teacherNameFor?.(session.teacherId)||'Enseignant')}</strong> <span class="badge badge-info">Lecture seule</span><br><small>Filière : ${esc(cls?.track||'—')} | Classe : ${esc(label)} | Groupe : ${cls?.groupNumber?`G${esc(cls.groupNumber)}`:'—'}<br>Module : ${esc(cls?.module||'—')} | Date : ${esc(session.date)} | Horaire : ${esc(session.start)} - ${esc(session.end)} | Salle : ${esc(cls?.room||'—')}</small></div>`;}list.appendChild(card);});
  };
})();
