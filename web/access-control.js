(function(){
  'use strict';
  const teacherNames=new Map();
  let foreignSessions=[];

  function isAdmin(){ return Boolean(currentTeacher?.isAdmin); }
  function canManageRecord(record){
    return Boolean(record) && (isAdmin() || String(record.teacherId||'')===String(currentTeacher?.id||''));
  }
  function esc(value){
    return String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }
  function teacherNameFor(id){
    if(String(id)===String(currentTeacher?.id)) return currentTeacher?.name||'Enseignant';
    return teacherNames.get(String(id))||'Enseignant';
  }
  async function refreshTeacherNames(){
    try{
      const {data:rows,error}=await supabaseClient.rpc('teacher_directory');
      if(error) throw error;
      for(const row of rows||[]) if(row.teacher_id && row.teacher_name) teacherNames.set(String(row.teacher_id),row.teacher_name);
      return true;
    }catch(e){ console.error('teacher directory',e); return false; }
  }
  function mapRemote(r){
    return {
      classes:(r.classes||[]).map(x=>({id:x.id,teacherId:x.teacher_id,name:x.name,track:x.track||'',classNumber:x.class_number||null,groupNumber:x.group_number||null,module:x.module,day:x.day||'',start:(x.start_time||'').slice(0,5),end:(x.end_time||'').slice(0,5),room:x.room||'',createdAt:x.created_at})),
      students:(r.students||[]).map(x=>({id:x.id,teacherId:x.teacher_id,lastname:x.last_name,firstname:x.first_name,email:x.email||'',classId:x.class_id,createdAt:x.created_at})),
      sessions:(r.sessions||[]).map(x=>({id:x.id,teacherId:x.teacher_id,date:x.session_date,start:(x.start_time||'').slice(0,5),end:(x.end_time||'').slice(0,5),classId:x.class_id,completedAt:x.completed_at||null,createdAt:x.created_at})),
      attendance:(r.attendance||[]).map(x=>({id:x.id,teacherId:x.teacher_id,sessionId:x.session_id,studentId:x.student_id,status:x.status,comment:x.comment||'',grade:x.grade==null?null:Number(x.grade),gradeUpdatedAt:x.grade_updated_at||null,timestamp:x.updated_at}))
    };
  }

  window.fetchRemoteData=async function(){
    if(!currentTeacher) return {classes:[],students:[],sessions:[],attendance:[]};
    const owner=currentTeacher.id;
    const classQ=supabaseClient.from('classes').select('*');
    const sessionQ=supabaseClient.from('sessions').select('*');
    const studentQ=isAdmin()?supabaseClient.from('students').select('*'):supabaseClient.from('students').select('*').eq('teacher_id',owner);
    const attendanceQ=isAdmin()?supabaseClient.from('attendance').select('*'):supabaseClient.from('attendance').select('*').eq('teacher_id',owner);
    const [c,st,se,a]=await Promise.all([classQ,studentQ,sessionQ,attendanceQ,refreshTeacherNames()]);
    const err=c.error||st.error||se.error||a.error; if(err) throw err;
    const mapped=mapRemote({classes:c.data,students:st.data,sessions:se.data,attendance:a.data});
    foreignSessions=mapped.sessions.filter(s=>!canManageRecord(s));
    window.FSTAccessControl.foreignSessions=foreignSessions;
    return mapped;
  };

  function ownedClasses(){ return (data?.classes||[]).filter(canManageRecord); }
  function manageableSessions(){ return (data?.sessions||[]).filter(canManageRecord); }

  window.renderClasses=function(){
    const tbody=document.querySelector('#classes-table tbody'); if(!tbody)return; tbody.innerHTML='';
    ownedClasses().forEach(classObj=>{
      const studentCount=(data.students||[]).filter(s=>s.classId===classObj.id).length;
      const row=document.createElement('tr');
      row.innerHTML=`<td>${esc(classObj.name)}</td><td>${esc(classObj.module)}</td><td>${esc(classObj.day||'—')}</td><td>${classObj.start&&classObj.end?`${esc(classObj.start)} - ${esc(classObj.end)}`:'—'}</td><td>${esc(classObj.room||'—')}</td><td><span class="badge badge-info">${studentCount} étudiants</span></td><td><button class="btn btn-sm btn-danger" onclick="deleteClass('${esc(classObj.id)}')"><i class="fas fa-trash"></i></button></td>`;
      tbody.appendChild(row);
    });
  };

  window.renderSessions=function(){
    const list=document.getElementById('sessions-list'); if(!list)return; list.innerHTML='';
    [...(data.sessions||[])].sort((a,b)=>new Date(b.date)-new Date(a.date)).forEach(session=>{
      const cls=(data.classes||[]).find(c=>String(c.id)===String(session.classId));
      const card=document.createElement('div'); card.className='student-item'; card.dataset.sessionDate=session.date;
      if(canManageRecord(session)){
        const count=(data.attendance||[]).filter(a=>String(a.sessionId)===String(session.id)).length;
        card.innerHTML=`<div><strong>${esc(cls?.name||'Classe supprimée')}</strong><br><small>${esc(session.date)} | ${esc(session.start)} - ${esc(session.end)}</small></div><div><span class="badge badge-info">${count} pointages</span> ${session.completedAt?'<span class="badge badge-present">Terminée</span>':''} <button class="btn btn-sm btn-info" onclick="openSessionForNotes('${esc(session.id)}')"><i class="fas fa-pen"></i> Notes</button> <button class="btn btn-sm btn-primary" onclick="generateSessionReport('${esc(session.id)}');switchTabProgrammatically('rapports')"><i class="fas fa-file-alt"></i> Rapport</button> <button class="btn btn-sm btn-danger" onclick="deleteSession('${esc(session.id)}')"><i class="fas fa-trash"></i></button></div>`;
      }else{
        const classLabel=cls?.classNumber?`${cls.track||''}${cls.classNumber}`:(cls?.name||'—');
        card.innerHTML=`<div><strong>${esc(teacherNameFor(session.teacherId))}</strong> <span class="badge badge-info">Lecture seule</span><br><small>Filière : ${esc(cls?.track||'—')} | Classe : ${esc(classLabel)} | Groupe : ${cls?.groupNumber?`G${esc(cls.groupNumber)}`:'—'}<br>Module : ${esc(cls?.module||'—')} | Date : ${esc(session.date)} | Horaire : ${esc(session.start)} - ${esc(session.end)} | Salle : ${esc(cls?.room||'—')}</small></div>`;
      }
      list.appendChild(card);
    });
  };

  window.updateAllSelects=function(){
    const classes=ownedClasses();
    for(const [id,label] of [['student-class','Sélectionner une classe'],['session-class','Sélectionner une classe'],['report-class','Sélectionner une classe']]){
      const el=document.getElementById(id); if(!el)continue; el.innerHTML=`<option value="">${label}</option>`;
      classes.forEach(c=>el.insertAdjacentHTML('beforeend',`<option value="${esc(c.id)}">${esc(c.name)}</option>`));
    }
  };
  window.updatePresenceSelect=function(){
    const el=document.getElementById('presence-session'); if(!el)return; el.innerHTML='<option value="">Sélectionner une séance</option>';
    [...manageableSessions()].sort((a,b)=>new Date(b.date)-new Date(a.date)).forEach(s=>{
      const c=(data.classes||[]).find(x=>String(x.id)===String(s.classId));
      el.insertAdjacentHTML('beforeend',`<option value="${esc(s.id)}">${esc(c?.name||'Classe supprimée')} - ${esc(s.date)} (${esc(s.start)})</option>`);
    });
  };

  function deny(){ showAlert('Cette séance est en lecture seule.','danger'); return false; }
  function sessionById(id){ return (data.sessions||[]).find(s=>String(s.id)===String(id)); }
  function classById(id){ return (data.classes||[]).find(c=>String(c.id)===String(id)); }

  const originalDeleteSession=window.deleteSession;
  window.deleteSession=async function(id){ const s=sessionById(id); if(!canManageRecord(s))return deny(); return originalDeleteSession?.call(this,id); };
  const originalDeleteClass=window.deleteClass;
  window.deleteClass=async function(id){ const c=classById(id); if(!canManageRecord(c))return deny(); return originalDeleteClass?.call(this,id); };
  const originalOpenSessionForNotes=window.openSessionForNotes;
  window.openSessionForNotes=function(id){ const s=sessionById(id); if(!canManageRecord(s))return deny(); return originalOpenSessionForNotes?.call(this,id); };
  window.saveAttendance=async function(showSuccess=true){
    const sid=document.getElementById('presence-session')?.value; const s=sessionById(sid); if(!canManageRecord(s))return deny();
    const rows=(data.attendance||[]).filter(a=>String(a.sessionId)===String(sid)).map(a=>({id:String(a.id),teacher_id:a.teacherId||s.teacherId||currentTeacher.id,session_id:String(a.sessionId),student_id:String(a.studentId),status:a.status||'present',comment:a.comment||'',grade:a.grade==null?null:Number(a.grade),grade_updated_at:a.gradeUpdatedAt||null}));
    if(rows.length){const {error}=await supabaseClient.from('attendance').upsert(rows);if(error){showAlert('Enregistrement impossible : '+error.message,'danger');return false;}}
    await window.FSTOnlineRuntime?.refreshAuthoritativeState();if(showSuccess)showAlert('Présence enregistrée avec succès','success');return true;
  };
  window.completeSessionAndReport=async function(id){
    const s=sessionById(id);if(!canManageRecord(s))return deny();if(!await window.saveAttendance(false))return false;
    const {error}=await supabaseClient.from('sessions').upsert({id:String(s.id),teacher_id:s.teacherId||currentTeacher.id,class_id:String(s.classId),session_date:s.date,start_time:s.start,end_time:s.end,completed_at:new Date().toISOString()});
    if(error){showAlert('Séance impossible à terminer : '+error.message,'danger');return false;}await window.FSTOnlineRuntime?.refreshAuthoritativeState();generateSessionReport(id);switchTabProgrammatically('rapports');showAlert('Séance terminée et rapport généré.','success');return true;
  };
  window.createSession=async function(){
    const date=document.getElementById('session-date')?.value,start=document.getElementById('session-start')?.value,end=document.getElementById('session-end')?.value,classId=document.getElementById('session-class')?.value,c=classById(classId);if(!canManageRecord(c))return deny();if(!date||!start||!end||!classId)return showAlert('Veuillez remplir tous les champs','danger');
    const {error}=await supabaseClient.from('sessions').insert({id:crypto.randomUUID(),teacher_id:c.teacherId||currentTeacher.id,class_id:String(classId),session_date:date,start_time:start,end_time:end});if(error){showAlert('Création impossible : '+error.message,'danger');return false;}await window.FSTOnlineRuntime?.refreshAuthoritativeState();showAlert('Séance créée avec succès','success');return true;
  };
  window.addStudent=async function(){
    const lastname=document.getElementById('student-lastname')?.value.trim(),firstname=document.getElementById('student-firstname')?.value.trim(),classId=document.getElementById('student-class')?.value,email=document.getElementById('student-email')?.value.trim(),c=classById(classId);if(!canManageRecord(c))return deny();if(!lastname||!firstname||!classId)return showAlert('Veuillez remplir tous les champs obligatoires','danger');
    const {error}=await supabaseClient.from('students').insert({id:crypto.randomUUID(),teacher_id:c.teacherId||currentTeacher.id,class_id:String(classId),last_name:lastname,first_name:firstname,email:email||null});if(error){showAlert('Ajout impossible : '+error.message,'danger');return false;}await window.FSTOnlineRuntime?.refreshAuthoritativeState();showAlert('Étudiant ajouté avec succès','success');return true;
  };

  window.FSTAccessControl={isAdmin,canManageRecord,foreignSessions,refreshTeacherNames,teacherNameFor,ownedClasses,manageableSessions};
})();
