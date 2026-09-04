(function(root,factory){
  const api=factory(root.V16PlanningState,root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.V16PlanningEditor=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(stateApi,host){
  'use strict';
  const MANIPULATIONS=['M1','M2','M3','M4','M5','M6'];
  const ROOMS=['A','B','C','D'];
  const dirtyWeeks=new Set();
  let ctx={supabaseClient:null,currentTeacher:null,teachers:[],planningState:{rows:[]},context:'real',onSaved:null};

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function isAdminActive(){const a=host.V16ActiveRole;return Boolean(a?.canUseAdminControls?.());}
  function teacherOptions(selected){return (ctx.teachers||[]).map(t=>`<option value="${esc(t.id)}"${String(t.id)===String(selected)?' selected':''}>${esc(t.full_name||t.email||t.id)}</option>`).join('');}
  function manipulationOptions(selected){return MANIPULATIONS.map(v=>`<option value="${v}"${v===selected?' selected':''}>${v}</option>`).join('');}
  function roomOptions(selected){return `<option value=""${!selected?' selected':''}>À choisir</option>`+ROOMS.map(v=>`<option value="${v}"${v===selected?' selected':''}>Salle ${v}</option>`).join('');}

  function renderGroupControls(row,group){
    if(!isAdminActive())return '';
    const key=`${row.date}|${row.className}|${group.groupNo}`;
    return {
      teacher:`<select class="form-control form-control-sm" data-v16-edit-teacher data-v16-edit-key="${esc(key)}"><option value="">Choisir…</option>${teacherOptions(group.teacherId)}</select>`,
      manipulation:`<select class="form-control form-control-sm" data-v16-edit-manipulation data-v16-edit-key="${esc(key)}">${manipulationOptions(group.manipulation)}</select>`,
      room:`<select class="form-control form-control-sm" data-v16-edit-room data-v16-edit-key="${esc(key)}">${roomOptions(group.room)}</select>`
    };
  }

  function findGroup(key){const [date,className,no]=String(key||'').split('|');const row=(ctx.planningState.rows||[]).find(r=>r.date===date&&r.className===className);const group=row?.groups?.find(g=>Number(g.groupNo)===Number(no));return {row,group};}
  function markDirty(row){if(row?.date)dirtyWeeks.add(stateApi.mondayFor(row.date));updateStatus();}
  function updateStatus(message){const box=typeof document!=='undefined'?document.querySelector('[data-v16-editor-status]'):null;if(box)box.textContent=message||`${dirtyWeeks.size} semaine(s) modifiée(s)`;const save=typeof document!=='undefined'?document.querySelector('[data-v16-save-weeks]'):null;if(save)save.disabled=dirtyWeeks.size===0;}

  function weekRows(weekStart){return (ctx.planningState.rows||[]).filter(r=>r.isTeachingSession!==false&&stateApi.mondayFor(r.date)===weekStart);}
  function payloadForWeek(weekStart){const rows=[];for(const row of weekRows(weekStart))for(const g of row.groups||[])rows.push({session_id:g.sessionId,group_no:Number(g.groupNo),teacher_id:g.teacherId,manipulation_code:g.manipulation,room:g.room});return rows;}

  async function saveDirtyWeeks(options={}){
    if(!isAdminActive())return {ok:false,code:'FORBIDDEN',message:'Accès Admin requis.'};
    const c=options.supabaseClient||ctx.supabaseClient;if(!c)throw new Error('Connexion Supabase indisponible.');
    const teacherIds=(ctx.teachers||[]).map(t=>t.id),results=[];
    for(const weekStart of [...dirtyWeeks].sort()){
      const rows=weekRows(weekStart),check=stateApi.validateWeek(rows,teacherIds);
      if(!check.ok){const first=check.blockers[0];return {ok:false,code:first?.code||'VALIDATION_FAILED',message:first?.message||'Planning invalide.',blockers:check.blockers};}
      const payload=payloadForWeek(weekStart);
      if(payload.some(x=>!x.session_id))return {ok:false,code:'SESSION_ID_REQUIRED',message:`Identifiant de séance manquant pour la semaine ${weekStart}.`};
      const rpc=ctx.context==='test'?'v16_save_test_week_plan':'v16_save_week_plan';
      const args=ctx.context==='test'?{p_week_start:weekStart,p_rows:payload}:{p_week_start:weekStart,p_rows:payload,p_context:'real'};
      const {data,error}=await c.rpc(rpc,args);if(error)throw error;if(data&&data.ok===false)return data;results.push(data||{ok:true,week_start:weekStart});
    }
    dirtyWeeks.clear();updateStatus('Planning enregistré.');if(typeof ctx.onSaved==='function')await ctx.onSaved(results);return {ok:true,results};
  }

  function bindTable(){
    if(typeof document==='undefined'||!isAdminActive())return;
    for(const select of document.querySelectorAll('[data-v16-edit-teacher],[data-v16-edit-manipulation],[data-v16-edit-room]'))select.addEventListener('change',()=>{
      const {row,group}=findGroup(select.getAttribute('data-v16-edit-key'));if(!row||!group)return;
      if(select.hasAttribute('data-v16-edit-teacher'))group.teacherId=select.value||null;
      else if(select.hasAttribute('data-v16-edit-manipulation'))group.manipulation=select.value;
      else group.room=select.value||null;
      markDirty(row);
    });
  }

  function panelHtml(){if(!isAdminActive())return '';return `<div class="card" data-v16-manual-editor="true" style="margin:14px 0"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><strong><i class="fas fa-pen-to-square"></i> Affectation manuelle</strong><span>Enseignant · manipulation · salle</span><button type="button" class="btn btn-success btn-sm" data-v16-save-weeks disabled>Enregistrer les semaines modifiées</button><span data-v16-editor-status>0 semaine modifiée</span></div></div>`;}
  function render(options={}){
    ctx={...ctx,...options,context:options.context==='test'?'test':'real'};
    if(!isAdminActive())return '';
    const anchor=typeof document!=='undefined'?document.getElementById('v16-admin-permutations'):null;
    if(anchor)anchor.innerHTML=panelHtml();
    if(typeof document!=='undefined')document.querySelector('[data-v16-save-weeks]')?.addEventListener('click',async()=>{updateStatus('Validation et enregistrement…');try{const r=await saveDirtyWeeks();if(!r.ok)updateStatus(`Erreur : ${r.message||r.code}`);}catch(e){updateStatus(`Erreur : ${e?.message||e}`);}});
    bindTable();updateStatus();return anchor?.innerHTML||panelHtml();
  }

  return {render,renderGroupControls,bindTable,saveDirtyWeeks,isAdminActive,dirtyWeeks};
});
