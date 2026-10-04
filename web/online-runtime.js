(function(){
  'use strict';
  const TABLES=['classes','students','sessions','attendance'];
  let channel=null, retryTimer=null, refreshTimer=null;
  const dateErrors=new Set();

  function overlay(){
    let el=document.getElementById('online-required-overlay');
    if(el) return el;
    el=document.createElement('div');
    el.id='online-required-overlay';
    el.style.cssText='display:none;position:fixed;inset:0;z-index:99999;background:rgba(238,247,255,.98);align-items:center;justify-content:center;padding:24px;text-align:center';
    el.innerHTML='<div style="max-width:520px;background:#fff;border-radius:18px;padding:28px;box-shadow:0 20px 60px rgba(0,0,0,.18)"><h2 style="color:#092f63;margin-bottom:12px">Connexion Internet requise</h2><p style="margin-bottom:18px">Cette application fonctionne uniquement en ligne. Aucune modification n’est enregistrée localement.</p><button type="button" class="btn btn-primary" id="online-retry-button">Réessayer</button></div>';
    document.body.appendChild(el);
    el.querySelector('#online-retry-button').onclick=retry;
    return el;
  }
  function setOnlineRequired(on,message){
    const el=overlay();
    const p=el.querySelector('p');
    if(message) p.textContent=message;
    el.style.display=on?'flex':'none';
    document.body.classList.toggle('online-required',on);
    if(typeof setSyncStatus==='function') setSyncStatus(on?'Connexion Internet requise':'En ligne',on?'danger':'success');
  }
  function requireOnline(){
    if(!navigator.onLine){ setOnlineRequired(true); return false; }
    return true;
  }

  async function refreshAuthoritativeState(){
    if(!requireOnline() || typeof currentTeacher==='undefined' || !currentTeacher) return false;
    const selected=document.getElementById('presence-session')?.value||'';
    try{
      const fresh=await fetchRemoteData();
      data=fresh;
      if(typeof renderAll==='function') renderAll();
      const presence=document.getElementById('presence-session');
      if(presence && selected && data.sessions.some(s=>String(s.id)===String(selected))){ presence.value=selected; if(typeof loadPresenceSheet==='function') loadPresenceSheet(); }
      if(currentTeacher.activeMode==='admin' && typeof renderAdminPanel==='function') await renderAdminPanel();
      dateErrors.clear(); applyDateStates(); setOnlineRequired(false); return true;
    }catch(e){ console.error(e); setOnlineRequired(true,'Serveur indisponible. Vérifiez votre connexion Internet puis réessayez.'); return false; }
  }

  function scheduleRefresh(){ clearTimeout(refreshTimer); refreshTimer=setTimeout(()=>void refreshAuthoritativeState(),150); }
  function stopRealtime(){ if(retryTimer){clearTimeout(retryTimer);retryTimer=null;} if(channel){ try{supabaseClient.removeChannel(channel);}catch(_){} channel=null; } }
  function startRealtime(){
    stopRealtime();
    if(!currentTeacher || !navigator.onLine) return;
    channel=supabaseClient.channel('presence-live-'+currentTeacher.id);
    for(const table of TABLES) channel=channel.on('postgres_changes',{event:'*',schema:'public',table},scheduleRefresh);
    channel.subscribe(status=>{
      if(status==='SUBSCRIBED'){ if(typeof setSyncStatus==='function') setSyncStatus('Temps réel actif','success'); return; }
      if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)){
        if(typeof setSyncStatus==='function') setSyncStatus('Reconnexion temps réel…','warning');
        clearTimeout(retryTimer); retryTimer=setTimeout(async()=>{ if(await refreshAuthoritativeState()) startRealtime(); },2000);
      }
    });
  }

  function stateFor(date){
    const rows=(data?.sessions||[]).filter(s=>s.date===date);
    if(dateErrors.has(date)) return 'red';
    if(rows.some(s=>Boolean(s.completedAt))) return 'green';
    if(rows.length) return 'blue';
    if(document.getElementById('session-date')?.value===date) return 'orange';
    return 'gray';
  }
  function applyDateStates(){
    const cls=['gray','orange','blue','green','red'].map(x=>'date-state-'+x);
    const input=document.getElementById('session-date');
    if(input){ input.classList.remove(...cls); if(input.value) input.classList.add('date-state-'+stateFor(input.value)); }
    document.querySelectorAll('[data-session-date]').forEach(el=>{el.classList.remove(...cls);el.classList.add('date-state-'+stateFor(el.dataset.sessionDate));});
  }
  function markDateError(date){if(date){dateErrors.add(date);applyDateStates();}}
  function injectDateStyles(){
    if(document.getElementById('online-date-state-styles'))return;
    const s=document.createElement('style');s.id='online-date-state-styles';s.textContent='.date-state-gray{outline:2px solid #adb5bd!important}.date-state-orange{outline:2px solid #fd7e14!important}.date-state-blue{outline:2px solid #0d6efd!important}.date-state-green{outline:2px solid #28a745!important}.date-state-red{outline:2px solid #dc3545!important}';document.head.appendChild(s);
  }

  function classRow(x){return {id:String(x.id),teacher_id:currentTeacher.id,name:x.name,track:x.track||null,class_number:x.classNumber||null,group_number:x.groupNumber||null,module:x.module||'',day:x.day||null,start_time:x.start||null,end_time:x.end||null,room:x.room||null};}
  function studentRow(x){return {id:String(x.id),teacher_id:currentTeacher.id,class_id:String(x.classId),last_name:x.lastname,first_name:x.firstname,email:x.email||null};}
  function sessionRow(x){return {id:String(x.id),teacher_id:currentTeacher.id,class_id:String(x.classId),session_date:x.date,start_time:x.start,end_time:x.end,completed_at:x.completedAt||null};}
  function attendanceRow(x){return {id:String(x.id),teacher_id:currentTeacher.id,session_id:String(x.sessionId),student_id:String(x.studentId),status:x.status||'present',comment:x.comment||'',grade:x.grade==null?null:Number(x.grade),grade_updated_at:x.gradeUpdatedAt||null,grade_origin:x.gradeOrigin||null,manual_grade_backup:x.manualGradeBackup==null?null:Number(x.manualGradeBackup)};}
  async function upsert(table,rows){ if(!requireOnline())return false; const {error}=await supabaseClient.from(table).upsert(rows); if(error){showAlert('Enregistrement impossible : '+error.message,'danger');return false;}return true; }
  async function remove(table,id){ if(!requireOnline())return false; const {error}=await supabaseClient.from(table).delete().eq('id',id); if(error){showAlert('Suppression impossible : '+error.message,'danger');return false;}return true; }

  window.addClass=async function(){
    if(!requireOnline())return; const track=document.getElementById('class-track').value,classNumber=Number(document.getElementById('class-number').value),groupNumber=Number(document.getElementById('class-group-number').value),module=document.getElementById('class-module').value.trim();
    if(!module)return showAlert('Veuillez remplir tous les champs','danger');
    const x={id:crypto.randomUUID(),name:buildGroupName(track,classNumber,groupNumber),track,classNumber,groupNumber,module,day:document.getElementById('class-day').value,start:document.getElementById('class-start').value,end:document.getElementById('class-end').value,room:document.getElementById('class-room').value.trim(),createdAt:new Date().toISOString()};
    if(!await upsert('classes',[classRow(x)]))return; await refreshAuthoritativeState(); showAlert('Classe ajoutée avec succès','success');
  };
  window.addStudent=async function(){
    if(!requireOnline())return; const lastname=document.getElementById('student-lastname').value.trim(),firstname=document.getElementById('student-firstname').value.trim(),classId=document.getElementById('student-class').value,email=document.getElementById('student-email').value.trim();
    if(!lastname||!firstname||!classId)return showAlert('Veuillez remplir tous les champs obligatoires','danger');
    const x={id:crypto.randomUUID(),lastname,firstname,email,classId,createdAt:new Date().toISOString()}; if(!await upsert('students',[studentRow(x)]))return; await refreshAuthoritativeState(); showAlert('Étudiant ajouté avec succès','success');
  };
  window.createSession=async function(){
    if(!requireOnline())return; const date=document.getElementById('session-date').value,start=document.getElementById('session-start').value,end=document.getElementById('session-end').value,classId=document.getElementById('session-class').value;
    if(!date||!start||!end||!classId)return showAlert('Veuillez remplir tous les champs','danger');
    const x={id:crypto.randomUUID(),date,start,end,classId,createdAt:new Date().toISOString()}; if(!await upsert('sessions',[sessionRow(x)])){markDateError(date);return;} await refreshAuthoritativeState(); showAlert('Séance créée avec succès','success');
  };
  window.deleteClass=async id=>{if(!confirm('Voulez-vous vraiment supprimer cette classe ?'))return;if(await remove('classes',id)){await refreshAuthoritativeState();showAlert('Classe supprimée','success');}};
  window.deleteStudent=async id=>{if(!confirm('Voulez-vous vraiment supprimer cet étudiant ?'))return;if(await remove('students',id)){await refreshAuthoritativeState();showAlert('Étudiant supprimé','success');}};
  window.deleteSession=async id=>{if(!confirm('Voulez-vous vraiment supprimer cette séance ?'))return;if(await remove('sessions',id)){await refreshAuthoritativeState();showAlert('Séance supprimée','success');}};
  window.saveAttendance=async function(showSuccess=true){
    if(!requireOnline())return false; const sid=document.getElementById('presence-session').value; const session=(data.sessions||[]).find(s=>String(s.id)===String(sid)); const rows=(data.attendance||[]).filter(a=>String(a.sessionId)===String(sid)).map(attendanceRow);
    if(rows.length&&!await upsert('attendance',rows)){markDateError(session?.date||'');await refreshAuthoritativeState();return false;} await refreshAuthoritativeState(); if(showSuccess)showAlert('Présence enregistrée avec succès','success'); return true;
  };
  window.completeSessionAndReport=async function(id){
    if(!await window.saveAttendance(false))return; const s=(data.sessions||[]).find(x=>String(x.id)===String(id)); if(!s)return; const done={...s,completedAt:new Date().toISOString()}; if(!await upsert('sessions',[sessionRow(done)])){markDateError(s.date);return;} await refreshAuthoritativeState(); generateSessionReport(id); switchTabProgrammatically('rapports'); showAlert('Séance terminée et rapport généré. Les notes restent modifiables.','success');
  };

  window.saveData=function(){ if(navigator.onLine) void refreshAuthoritativeState(); else setOnlineRequired(true); };
  window.syncAllData=refreshAuthoritativeState;
  window.queueSync=function(){ if(!navigator.onLine)setOnlineRequired(true); };

  const originalDoLogin=window.doLogin;
  if(originalDoLogin) window.doLogin=async function(profile,mode){ if(!requireOnline())return false; localStorage.removeItem('presence_profile_cache'); const r=await originalDoLogin(profile,mode); if(currentTeacher){await refreshAuthoritativeState();startRealtime();} return r; };
  window.restorePersistentSession=async function(){
    try{ if(!requireOnline()){await renderAuthScreen();return false;} const {data:{session},error}=await supabaseClient.auth.getSession(); if(error||!session?.user){await renderAuthScreen();return false;} const {data:profile,error:pErr}=await supabaseClient.from('profiles').select('id,email,username,full_name,role').eq('id',session.user.id).single(); if(pErr||!profile){setOnlineRequired(true);await renderAuthScreen();return false;} let mode=localStorage.getItem(ACTIVE_MODE_KEY)||'teacher'; if(mode==='admin'&&profile.role!=='admin')mode='teacher'; await window.doLogin(profile,mode); return true;}catch(e){console.error(e);setOnlineRequired(true);await renderAuthScreen();return false;}
  };

  for(const name of ['loginTeacher','changeOwnPin','setAdminPin','adminCreateTeacher','adminSetAdminRole','adminResetPin','adminDeleteTeacher']){
    const fn=window[name]; if(typeof fn==='function') window[name]=async function(...args){if(!requireOnline())return;return await fn.apply(this,args);};
  }
  const originalLogout=window.logoutTeacher; if(originalLogout)window.logoutTeacher=async function(...args){stopRealtime();return await originalLogout.apply(this,args);};
  const originalSwitch=window.switchAccount; if(originalSwitch)window.switchAccount=async function(...args){stopRealtime();return await originalSwitch.apply(this,args);};

  async function retry(){ if(!navigator.onLine)return setOnlineRequired(true); setOnlineRequired(true,'Reconnexion au serveur…'); if(await refreshAuthoritativeState())startRealtime(); }
  function initialize(){injectDateStyles();overlay();window.addEventListener('offline',()=>{stopRealtime();setOnlineRequired(true);});window.addEventListener('online',()=>void retry());document.getElementById('session-date')?.addEventListener('change',applyDateStates);if(!navigator.onLine)setOnlineRequired(true);}

  window.FSTOnlineRuntime={TABLES,initialize,retry,requireOnline,setOnlineRequired,refreshAuthoritativeState,startRealtime,stopRealtime,applyDateStates,markDateError};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();
