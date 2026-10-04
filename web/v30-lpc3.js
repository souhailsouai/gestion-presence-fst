(function(root){
'use strict';

const OWNER_ID='e9a874d5-4e7e-48f2-a8bd-d59003599570';
const MODULE='TP Ondes et Vibrations';
const START='08:30';
const END='11:30';
const ROOM='Onde';
const SCHEDULE=[
  ['2026-10-05','LPC3-G1'],['2026-10-08','LPC3-G2'],['2026-10-12','LPC3-G3'],
  ['2026-10-19','LPC3-G1'],['2026-10-22','LPC3-G4'],['2026-10-26','LPC3-G3'],['2026-10-29','LPC3-G2'],
  ['2026-11-02','LPC3-G1'],['2026-11-05','LPC3-G4'],['2026-11-09','LPC3-G3'],['2026-11-12','LPC3-G2'],
  ['2026-11-16','LPC3-G1'],['2026-11-19','LPC3-G4'],['2026-11-23','LPC3-G3'],['2026-11-26','LPC3-G2'],
  ['2026-11-30','LPC3-G1'],['2026-12-03','LPC3-G4'],['2026-12-07','LPC3-G3'],['2026-12-10','LPC3-G2']
];
const state={classes:[],students:[],sessions:[],attendance:[],selectedSessionId:''};

function teacher(){
  try{return typeof currentTeacher!=='undefined'?currentTeacher:(root.currentTeacher||null);}
  catch(_){return root.currentTeacher||null;}
}
function isOwner(){return String(teacher()?.id||'')===OWNER_ID;}
function client(){
  try{return typeof supabaseClient!=='undefined'?supabaseClient:(root.supabaseClient||null);}
  catch(_){return root.supabaseClient||null;}
}
function esc(v){return String(v??'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function fmtDate(v){var m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?m[3]+'/'+m[2]+'/'+m[1]:String(v||'');}
function classById(id){return state.classes.find(function(c){return String(c.id)===String(id);});}
function sessionById(id){return state.sessions.find(function(s){return String(s.id)===String(id);});}
function studentsForClass(id){return state.students.filter(function(s){return String(s.class_id)===String(id);});}
function attendanceFor(sessionId,studentId){return state.attendance.find(function(a){return String(a.session_id)===String(sessionId)&&String(a.student_id)===String(studentId);});}
function statusOptions(value){
  return [['present','Présent'],['absent','Absent'],['retard','Retard'],['justifie','Justifié']].map(function(x){
    return '<option value="'+x[0]+'" '+(x[0]===value?'selected':'')+'>'+x[1]+'</option>';
  }).join('');
}

function ensureStyle(){
  if(document.getElementById('v30-lpc3-style'))return;
  var s=document.createElement('style');s.id='v30-lpc3-style';
  s.textContent=
    '#presence-lpc3 .lpc3-head{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0 18px}'+
    '#presence-lpc3 .lpc3-head .badge{font-size:.92rem;padding:8px 10px}'+
    '#presence-lpc3 .lpc3-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin:14px 0}'+
    '#presence-lpc3 .lpc3-card{border:1px solid #dce6f2;border-radius:12px;padding:14px;background:#fff}'+
    '#presence-lpc3 .lpc3-card h3{margin:0 0 10px}'+
    '#presence-lpc3 .lpc3-toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin:14px 0}'+
    '#presence-lpc3 .lpc3-toolbar .form-group{min-width:280px;flex:1;margin:0}'+
    '#presence-lpc3 .lpc3-note{font-size:.9rem;color:var(--gray);margin-top:8px}'+
    '#presence-lpc3 .lpc3-student-list{margin:0;padding-left:22px}'+
    '#presence-lpc3 .lpc3-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:12px 0}'+
    '#presence-lpc3 .lpc3-kpi{padding:10px;border-radius:10px;background:#f5f9ff;text-align:center}'+
    '@media(max-width:600px){#presence-lpc3 .lpc3-toolbar .form-group{min-width:100%}}';
  document.head.appendChild(s);
}

function ensureScaffold(){
  ensureStyle();
  var nav=document.querySelector('.nav-tabs[data-v16-navigation="true"]')||document.querySelector('.nav-tabs');
  if(nav&&!document.getElementById('lpc3-nav-tab')){
    var b=document.createElement('button');
    b.id='lpc3-nav-tab';b.className='nav-tab';b.style.display='none';
    b.innerHTML='<i class="fas fa-wave-square"></i> LPC3';
    b.onclick=function(){root.switchTab?.('presence-lpc3');};
    var presenceButton=[].slice.call(nav.querySelectorAll('.nav-tab')).find(function(x){return String(x.getAttribute('onclick')||'').indexOf("'presence'")>=0;});
    if(presenceButton&&presenceButton.nextSibling)nav.insertBefore(b,presenceButton.nextSibling);else nav.appendChild(b);
  }
  var host=document.getElementById('app-container');
  if(host&&!document.getElementById('presence-lpc3')){
    var tab=document.createElement('div');tab.id='presence-lpc3';tab.className='tab-content';
    tab.innerHTML=
      '<h2><i class="fas fa-wave-square"></i> Présence LPC3 — TP Ondes et Vibrations</h2>'+
      '<div class="lpc3-head">'+
        '<span class="badge badge-info"><i class="fas fa-clock"></i> 08h30–11h30</span>'+
        '<span class="badge badge-info"><i class="fas fa-door-open"></i> Salle Onde</span>'+
        '<span class="badge badge-info"><i class="fas fa-users"></i> Groupes G1–G4</span>'+
      '</div>'+
      '<div class="alert alert-info"><i class="fas fa-circle-info"></i><div><strong>Rubrique privée LPC3.</strong><br>Cette rubrique regroupe uniquement les TP d’Ondes et Vibrations de LPC3 et n’est affichée que pour Dr. Souhail Souai.</div></div>'+
      '<div class="lpc3-grid">'+
        '<section class="lpc3-card"><h3>Planning LPC3</h3><div id="lpc3-planning"></div><div class="lpc3-note">15/10/2026 : jour férié, aucune séance. Le rattrapage final de G4 reste à fixer.</div></section>'+
        '<section class="lpc3-card"><h3>Étudiants LPC3</h3><div id="lpc3-students"></div></section>'+
      '</div>'+
      '<section class="lpc3-card"><h3>Saisie de présence LPC3</h3>'+
        '<div class="lpc3-toolbar"><div class="form-group"><label>Sélectionner une séance</label><select id="lpc3-session" class="form-control"></select></div>'+
        '<button id="lpc3-refresh" class="btn btn-info" type="button"><i class="fas fa-rotate"></i> Actualiser</button></div>'+
        '<div id="lpc3-sheet"></div></section>'+
      '<section class="lpc3-card" style="margin-top:14px"><h3>Suivi des séances</h3><div id="lpc3-report"></div></section>';
    var firstContent=host.querySelector('.tab-content');
    if(firstContent)host.appendChild(tab);else host.appendChild(tab);
    tab.querySelector('#lpc3-session').addEventListener('change',function(){state.selectedSessionId=this.value;renderSheet();});
    tab.querySelector('#lpc3-refresh').addEventListener('click',function(){void refresh();});
  }
}

function syncAccess(){
  ensureScaffold();
  var nav=document.getElementById('lpc3-nav-tab'),tab=document.getElementById('presence-lpc3'),ok=isOwner();
  if(nav)nav.style.display=ok?'':'none';
  if(tab&&!ok&&tab.classList.contains('active'))root.switchTab?.('dashboard');
  if(ok&&tab?.classList.contains('active')&&!state.classes.length)void refresh();
  isolateGenericUi();
  return ok;
}

function isolateGenericUi(){
  document.querySelectorAll('[data-v16-class-family="LPC3"],[data-v16-class-family^="LPC3-"]').forEach(function(el){var section=el.closest('section,div.card')||el;section.style.display='none';});
  document.querySelectorAll('#classes-table tbody tr,#sessions-list .student-item').forEach(function(el){if(/LPC3|Ondes et Vibrations/i.test(el.textContent||''))el.style.display='none';});
  var report=document.getElementById('report-class');if(report)[].slice.call(report.options).forEach(function(o){if(/LPC3|Ondes et Vibrations/i.test(o.textContent||''))o.remove();});
}

async function fetchRows(){
  var c=client();if(!c||!isOwner())throw new Error('Accès LPC3 non autorisé.');
  var cls=await c.from('classes').select('id,teacher_id,name,module,day,start_time,end_time,room').eq('teacher_id',OWNER_ID).eq('module',MODULE).is('deleted_at',null).order('name');
  if(cls.error)throw cls.error;
  state.classes=(cls.data||[]).filter(function(x){return /^LPC3-G[1-4]$/i.test(String(x.name||''));});
  var classIds=state.classes.map(function(x){return x.id;});
  if(!classIds.length){state.students=[];state.sessions=[];state.attendance=[];return;}
  var results=await Promise.all([
    c.from('students').select('id,teacher_id,class_id,last_name,first_name,email').in('class_id',classIds).is('deleted_at',null).order('last_name').order('first_name'),
    c.from('sessions').select('id,teacher_id,class_id,session_date,start_time,end_time,completed_at').eq('teacher_id',OWNER_ID).in('class_id',classIds).is('deleted_at',null).order('session_date',{ascending:true}).order('start_time',{ascending:true})
  ]);
  if(results[0].error)throw results[0].error;if(results[1].error)throw results[1].error;
  state.students=results[0].data||[];state.sessions=results[1].data||[];
  var sessionIds=state.sessions.map(function(x){return x.id;});
  if(!sessionIds.length){state.attendance=[];return;}
  var plans=await c.from('session_plans').select('session_id,manipulation,status').in('session_id',sessionIds).is('deleted_at',null);
  if(plans.error)throw plans.error;
  var manipulationBySession=new Map((plans.data||[]).filter(function(p){return p.session_id&&p.manipulation;}).map(function(p){return [String(p.session_id),p.manipulation];}));
  state.sessions.forEach(function(s){s.manipulation=manipulationBySession.get(String(s.id))||s.manipulation||'';});
  var at=await c.from('attendance').select('id,teacher_id,session_id,student_id,status,comment,grade,grade_origin,manual_grade_backup,grade_only,updated_at').in('session_id',sessionIds).is('deleted_at',null);
  if(at.error)throw at.error;state.attendance=at.data||[];
}

function renderPlanning(){
  var box=document.getElementById('lpc3-planning');if(!box)return;
  var byGroup={G1:[],G2:[],G3:[],G4:[]};
  SCHEDULE.forEach(function(x){var g=x[1].split('-').pop();byGroup[g].push(fmtDate(x[0]));});
  box.innerHTML='<div class="table-responsive"><table class="table"><thead><tr><th>Groupe</th><th>Jour</th><th>Dates</th></tr></thead><tbody>'+
    ['G1','G2','G3','G4'].map(function(g){
      return '<tr><td><strong>'+g+'</strong></td><td>'+(g==='G1'||g==='G3'?'Lundi':'Jeudi')+'</td><td>'+byGroup[g].join(' · ')+'</td></tr>';
    }).join('')+'</tbody></table></div>';
}

function renderStudents(){
  var box=document.getElementById('lpc3-students');if(!box)return;
  box.innerHTML=state.classes.map(function(c){
    var students=studentsForClass(c.id);
    return '<div style="margin-bottom:12px"><strong>'+esc(c.name)+' — '+students.length+' étudiant(s)</strong>'+
      '<ol class="lpc3-student-list">'+students.map(function(s){return '<li>'+esc(s.last_name)+' '+esc(s.first_name)+'</li>';}).join('')+'</ol></div>';
  }).join('')||'<div class="alert alert-warning">Aucun étudiant LPC3 chargé.</div>';
}

function renderSessionSelect(){
  var select=document.getElementById('lpc3-session');if(!select)return;
  var previous=state.selectedSessionId||select.value||'';
  select.innerHTML='<option value="">Sélectionner une séance LPC3</option>';
  state.sessions.forEach(function(s){
    var c=classById(s.class_id),o=document.createElement('option');o.value=s.id;
    o.textContent=fmtDate(s.session_date)+' — '+(c?.name||'LPC3')+' — '+START+'–'+END+' — Salle '+ROOM;
    select.appendChild(o);
  });
  if(previous&&state.sessions.some(function(s){return String(s.id)===String(previous);})){select.value=previous;state.selectedSessionId=previous;}
  else{state.selectedSessionId='';}
}

function renderSheet(){
  var box=document.getElementById('lpc3-sheet');if(!box)return;
  var s=sessionById(state.selectedSessionId);if(!s){box.innerHTML='<div class="auth-note">Choisissez une séance pour saisir la présence.</div>';return;}
  var c=classById(s.class_id),students=studentsForClass(s.class_id);
  var html='<div class="alert alert-info"><i class="fas fa-circle-info"></i><div><strong>'+esc(c?.name||'LPC3')+'</strong> — '+fmtDate(s.session_date)+' — '+START+'–'+END+' — Salle '+ROOM+'</div></div>';
  html+='<div class="table-responsive"><table class="table"><thead><tr><th>N°</th><th>Étudiant</th><th>Présence</th><th>Commentaire</th><th>Note /20</th></tr></thead><tbody>';
  students.forEach(function(st,i){
    var a=attendanceFor(s.id,st.id),status=a?.status||'present';
    html+='<tr data-lpc3-student="'+esc(st.id)+'"><td>'+(i+1)+'</td><td>'+esc(st.last_name)+' '+esc(st.first_name)+'</td>'+
      '<td><select class="form-control lpc3-status">'+statusOptions(status)+'</select></td>'+
      '<td><input class="form-control lpc3-comment" value="'+esc(a?.comment||'')+'" placeholder="Commentaire"></td>'+
      '<td><input type="number" min="0" max="20" step="0.25" class="form-control lpc3-grade" value="'+(status==='absent'?0:(a?.grade==null?'':esc(a.grade)))+'" placeholder="—" '+((status==='absent'||status==='justifie')?'disabled':'')+'></td></tr>';
  });
  html+='</tbody></table></div><button id="lpc3-save" class="btn btn-success" type="button"><i class="fas fa-save"></i> Enregistrer la présence LPC3</button>';
  box.innerHTML=html;
  box.querySelectorAll('.lpc3-status').forEach(function(select){
    select.addEventListener('change',function(){
      var tr=this.closest('tr[data-lpc3-student]'),grade=tr?.querySelector('.lpc3-grade');if(!grade)return;
      if(this.value==='absent'){grade.value='0';grade.disabled=true;}
      else if(this.value==='justifie'){grade.value='';grade.disabled=true;}
      else grade.disabled=false;
    });
  });
  box.querySelector('#lpc3-save')?.addEventListener('click',function(){void saveAttendance();});
}

async function saveAttendance(){
  if(!isOwner())return root.showAlert?.('Accès LPC3 non autorisé.','danger');
  var s=sessionById(state.selectedSessionId),box=document.getElementById('lpc3-sheet'),c=client();if(!s||!box||!c)return;
  var payload=[];
  box.querySelectorAll('tr[data-lpc3-student]').forEach(function(tr){
    var gradeText=tr.querySelector('.lpc3-grade')?.value||'',grade=gradeText===''?null:Number(gradeText);
    if(grade!==null&&(!Number.isFinite(grade)||grade<0||grade>20))throw new Error('Une note LPC3 doit être comprise entre 0 et 20.');
    var status=tr.querySelector('.lpc3-status')?.value||'present';
    var previous=attendanceFor(s.id,tr.dataset.lpc3Student);
    var rule=root.FSTV31Domain?.applyAttendanceGradeRule?.({
      status:status,
      grade:grade,
      gradeOrigin:previous?.grade_origin||previous?.gradeOrigin||(grade===null?null:'manual'),
      manualGradeBackup:previous?.manual_grade_backup??previous?.manualGradeBackup??null
    })||{valid:true,grade:grade,gradeOrigin:grade===null?null:'manual',manualGradeBackup:null};
    if(!rule.valid)throw new Error(rule.message||'Note LPC3 invalide.');
    payload.push({
      teacher_id:OWNER_ID,session_id:s.id,student_id:tr.dataset.lpc3Student,
      status:status,
      comment:tr.querySelector('.lpc3-comment')?.value||'',
      grade:rule.grade,grade_origin:rule.gradeOrigin,manual_grade_backup:rule.manualGradeBackup,
      grade_only:false,grade_updated_at:rule.grade===null?null:new Date().toISOString()
    });
  });
  try{
    var r=await c.from('attendance').upsert(payload,{onConflict:'session_id,student_id'});
    if(r.error)throw r.error;
    root.showAlert?.('Présence LPC3 enregistrée.','success');await refresh();
  }catch(e){root.showAlert?.('Enregistrement LPC3 impossible : '+(e?.message||e),'danger');}
}

function renderReport(){
  var box=document.getElementById('lpc3-report');if(!box)return;
  var rows=state.sessions.map(function(s){
    var c=classById(s.class_id),students=studentsForClass(s.class_id),ats=students.map(function(st){return attendanceFor(s.id,st.id);});
    var n=function(status){return ats.filter(function(a){return (a?.status||'present')===status;}).length;};
    return '<tr><td>'+fmtDate(s.session_date)+'</td><td>'+esc(c?.name||'LPC3')+'</td><td>'+students.length+'</td><td>'+n('present')+'</td><td>'+n('absent')+'</td><td>'+n('retard')+'</td><td>'+n('justifie')+'</td></tr>';
  }).join('');
  box.innerHTML='<div class="lpc3-summary"><div class="lpc3-kpi"><strong>'+state.sessions.length+'</strong><br>Séances</div><div class="lpc3-kpi"><strong>'+state.students.length+'</strong><br>Étudiants</div><div class="lpc3-kpi"><strong>'+ROOM+'</strong><br>Salle</div><div class="lpc3-kpi"><strong>'+START+'–'+END+'</strong><br>Horaire</div></div>'+
    '<div class="table-responsive"><table class="table"><thead><tr><th>Date</th><th>Groupe</th><th>Effectif</th><th>Présents</th><th>Absents</th><th>Retards</th><th>Justifiés</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
}

async function refresh(){
  var tab=document.getElementById('presence-lpc3');if(!tab||!isOwner())return false;
  var sheet=document.getElementById('lpc3-sheet');if(sheet)sheet.innerHTML='<div class="alert alert-info">Chargement LPC3…</div>';
  try{
    await fetchRows();renderPlanning();renderStudents();renderSessionSelect();renderSheet();renderReport();isolateGenericUi();return true;
  }catch(e){if(sheet)sheet.innerHTML='<div class="alert alert-danger">Impossible de charger LPC3 : '+esc(e?.message||e)+'</div>';return false;}
}

function wrapSwitch(){
  var old=root.switchTab;if(typeof old!=='function'||old.__v30Lpc3)return;
  var wrapped=function(name){
    if(name==='presence-lpc3'&&!isOwner())return false;
    var r=old.apply(this,arguments);
    if(name==='presence-lpc3')setTimeout(function(){void refresh();},0);
    else setTimeout(isolateGenericUi,0);
    return r;
  };
  wrapped.__v30Lpc3=true;root.switchTab=wrapped;
}

function init(){ensureScaffold();wrapSwitch();syncAccess();renderPlanning();setInterval(syncAccess,1200);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();

root.V30LPC3={OWNER_ID:OWNER_ID,MODULE:MODULE,SCHEDULE:SCHEDULE,isOwner:isOwner,refresh:refresh,isolateGenericUi:isolateGenericUi,state:state};
if(typeof module==='object'&&module.exports)module.exports={OWNER_ID:OWNER_ID,MODULE:MODULE,SCHEDULE:SCHEDULE};
})(typeof window!=='undefined'?window:globalThis);
