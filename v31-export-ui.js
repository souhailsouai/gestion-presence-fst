(function(root){
'use strict';

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function baseClass(name){return String(name||'').replace(/-G\d+$/i,'');}
function environmentForClass(cls){return root.FSTV31Domain?.environmentForClass(cls)||'MPI1_PC1';}
function manipulationForSession(session){
  return session?.manipulation||session?.manipulationCode||session?.manipulation_code||session?.manipulationId||session?.manipulation_id||'';
}
function runtimeData(){try{return typeof data!=='undefined'?data:(root.data||{});}catch(_){return root.data||{};}}
function teacher(){try{return typeof currentTeacher!=='undefined'?currentTeacher:(root.currentTeacher||null);}catch(_){return root.currentTeacher||null;}}
function alertUser(message,type){try{if(typeof showAlert==='function')showAlert(message,type);else root.showAlert?.(message,type);}catch(_){}}

async function loadPlanManipulations(){
  let client=null;try{client=typeof supabaseClient!=='undefined'?supabaseClient:root.supabaseClient;}catch(_){client=root.supabaseClient;}
  if(!client)return new Map();
  const {data:plans,error}=await client.from('session_plans').select('session_id,manipulation,status,plan_kind').not('session_id','is',null).is('deleted_at',null);
  if(error)throw error;
  return new Map((plans||[]).filter(p=>p.session_id&&p.manipulation&&String(p.status||'').toLowerCase()!=='cancelled').map(p=>[String(p.session_id),p.manipulation]));
}
function modelsFromRuntime(environment,planMap){
  const d=runtimeData(),classes=(d.classes||[]).filter(c=>environmentForClass(c)===environment);
  const sessions=d.sessions||[],attendance=d.attendance||[],students=d.students||[];
  const families=[...new Set(classes.map(c=>baseClass(c.name)).filter(Boolean))];
  return families.map(family=>{
    const familyClasses=classes.filter(c=>baseClass(c.name)===family),classIds=new Set(familyClasses.map(c=>String(c.id)));
    const familyStudents=students.filter(st=>classIds.has(String(st.classId||st.class_id)));
    const studentIds=new Set(familyStudents.map(s=>String(s.id)));
    const familySessions=sessions.filter(s=>classIds.has(String(s.classId||s.class_id)));
    const sessionById=new Map(familySessions.map(s=>[String(s.id),s]));
    const rows=attendance.filter(a=>studentIds.has(String(a.studentId||a.student_id))&&sessionById.has(String(a.sessionId||a.session_id))).map(a=>{
      const s=sessionById.get(String(a.sessionId||a.session_id)),cls=familyClasses.find(c=>String(c.id)===String(s.classId||s.class_id));
      return {
        studentId:a.studentId||a.student_id,
        sessionId:s.id,
        className:cls?.name||family,
        groupName:cls?.name||family,
        manipulationCode:manipulationForSession(s)||(planMap&&planMap.get(String(s.id)))||'',
        manipulationLabel:manipulationForSession(s)||(planMap&&planMap.get(String(s.id)))||'',
        status:a.status,
        grade:a.grade,
        gradeOrigin:a.gradeOrigin||a.grade_origin||null,
        environment,
        applicable:true
      };
    }).filter(r=>r.manipulationCode);
    return {environment,className:family,students:familyStudents,rows};
  });
}

function lpc3Model(){
  const state=root.V30LPC3?.state;if(!state)return null;
  const classById=new Map((state.classes||[]).map(c=>[String(c.id),c]));
  const sessionById=new Map((state.sessions||[]).map(s=>[String(s.id),s]));
  const rows=(state.attendance||[]).map(a=>{
    const s=sessionById.get(String(a.session_id));if(!s)return null;
    const cls=classById.get(String(s.class_id));
    const manipulation=manipulationForSession(s)||s.manipulation||'TP';
    return {studentId:a.student_id,sessionId:s.id,className:cls?.name||'LPC3',groupName:cls?.name||'LPC3',manipulationCode:manipulation,manipulationLabel:manipulation,status:a.status,grade:a.grade,gradeOrigin:a.grade_origin||null,environment:'LPC3',applicable:true};
  }).filter(Boolean);
  return {environment:'LPC3',className:'LPC3',students:state.students||[],rows};
}

function ensureStyle(){
  if(document.getElementById('v31-export-style'))return;
  const s=document.createElement('style');s.id='v31-export-style';
  s.textContent='.v31-export-panel{margin:16px 0;padding:14px;border:1px solid #dce6f2;border-radius:12px;background:#fff}.v31-export-actions{display:flex;gap:8px;flex-wrap:wrap}.v31-export-panel h3{margin:0 0 10px}@media(max-width:600px){.v31-export-actions .btn{width:100%}}';
  document.head.appendChild(s);
}
function panel(id,title,includePerClass){
  return '<section id="'+id+'" class="v31-export-panel"><h3><i class="fas fa-file-excel"></i> '+esc(title)+'</h3><div class="v31-export-actions">'+
    (includePerClass?'<button class="btn btn-info" type="button" data-v31-export="classes"><i class="fas fa-file-export"></i> Un fichier par classe</button>':'')+
    '<button class="btn btn-success" type="button" data-v31-export="global"><i class="fas fa-file-excel"></i> Export Excel</button></div></section>';
}
function bindPanel(el,environment){
  el.querySelector('[data-v31-export="classes"]')?.addEventListener('click',async()=>{
    try{const planMap=await loadPlanManipulations();const models=modelsFromRuntime(environment,planMap);if(!models.length)throw new Error('Aucune classe disponible.');root.FSTV31TrackingXlsx.generatePerClass(models,{environment});}
    catch(e){alertUser('Export Excel impossible : '+(e?.message||e),'danger');}
  });
  el.querySelector('[data-v31-export="global"]')?.addEventListener('click',async()=>{
    try{
      if(environment==='LPC3'){
        if(!root.V30LPC3?.isOwner?.())throw new Error('Accès LPC3 non autorisé.');
        const refreshed=await root.V30LPC3.refresh?.();
        if(refreshed!==true||!root.V30LPC3?.isOwner?.())throw new Error('Données LPC3 non confirmées.');
        const model=lpc3Model();if(!model)throw new Error('Données LPC3 indisponibles.');
        root.FSTV31TrackingXlsx.generate(model,{environment:'LPC3'});
      }else{
        const planMap=await loadPlanManipulations();const models=modelsFromRuntime(environment,planMap);if(!models.length)throw new Error('Aucune classe disponible.');
        root.FSTV31TrackingXlsx.generate(models,{environment});
      }
    }catch(e){alertUser('Export Excel impossible : '+(e?.message||e),'danger');}
  });
}
function mount(){
  if(!root.document||!root.FSTV31TrackingXlsx)return false;ensureStyle();
  const stats=document.getElementById('statistiques')||document.getElementById('statistics')||document.getElementById('rapports')||document.getElementById('reports');
  if(stats&&!document.getElementById('v31-mpi-export')){
    const box=document.createElement('div');box.innerHTML=panel('v31-mpi-export','Exports de suivi MPI1-PC1',true);
    const el=box.firstElementChild;stats.appendChild(el);bindPanel(el,'MPI1_PC1');
  }
  const lpc=document.getElementById('presence-lpc3');
  if(lpc&&root.V30LPC3?.isOwner?.()&&!document.getElementById('v31-lpc3-export')){
    const box=document.createElement('div');box.innerHTML=panel('v31-lpc3-export','Export de suivi LPC3',false);
    const el=box.firstElementChild;lpc.appendChild(el);bindPanel(el,'LPC3');
  }
  return true;
}
if(root.document?.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>setTimeout(mount,0),{once:true});else setTimeout(mount,0);
for(const event of ['fst:shell-ready','fst:tab-activated','fst:lpc3-updated'])root.addEventListener?.(event,mount);
root.addEventListener?.('fst:auth-changed',()=>{if(!root.V30LPC3?.isOwner?.())document.getElementById('v31-lpc3-export')?.remove();mount();});
root.FSTV31ExportUi={mount,modelsFromRuntime,lpc3Model,loadPlanManipulations};
})(typeof window!=='undefined'?window:globalThis);
