(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./v16-planning-state.js'):root.V16PlanningState,root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.V16PlanningEditor=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(stateApi,host){
  'use strict';
  let ctx={supabaseClient:null,planningState:null,teachers:[],context:'real',onSaved:null};
  const dirtyWeeks=new Set();
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function canUseAdminControls(){return host.V16ActiveRole?.canUseAdminControls?.()===true;}
  function teacherName(id,teachers){if(!id)return 'Non affecté';return (teachers||[]).find(t=>String(t.id)===String(id))?.full_name||String(id);}
  function selected(a,b){return String(a??'')===String(b??'')?' selected':'';}
  function mondayFor(date){const m=String(date||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return '';const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));const day=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()-(day-1));return d.toISOString().slice(0,10);}
  function coords(row,group){return `data-date="${esc(row.date)}" data-class="${esc(row.className)}" data-group="${Number(group.groupNo)}"`;}
  function render(options={}){
    const row=options.row||{},group=options.group||{},teachers=options.teachers||[];
    const editable=options.isAdmin===true||(options.isAdmin==null&&canUseAdminControls());
    if(!editable)return {editable:false,teacher:esc(teacherName(group.teacherId,teachers)),manipulation:esc(group.manipulation||'—'),room:group.room?`Salle ${esc(group.room)}`:'À choisir'};
    const c=coords(row,group);
    const teacher=`<select class="form-control form-control-sm" data-v16-edit-teacher ${c}><option value="">Choisir…</option>${teachers.map(t=>`<option value="${esc(t.id)}"${selected(t.id,group.teacherId)}>${esc(t.full_name||t.email||t.id)}</option>`).join('')}</select>`;
    const manipulation=`<select class="form-control form-control-sm" data-v16-edit-manipulation ${c}>${[1,2,3,4,5,6].map(n=>`<option value="M${n}"${selected(`M${n}`,group.manipulation)}>M${n}</option>`).join('')}</select>`;
    const room=`<select class="form-control form-control-sm" data-v16-edit-room ${c}><option value=""${selected('',group.room)}>À choisir</option>${['A','B','C','D'].map(r=>`<option value="${r}"${selected(r,group.room)}>Salle ${r}</option>`).join('')}</select>`;
    return {editable:true,teacher,manipulation,room};
  }
  function toolbar(isAdmin){if(!isAdmin)return '';return `<div class="card" data-v16-manual-editor="true" style="margin:12px 0"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><strong>Édition manuelle du planning</strong><span style="color:var(--gray)">Enseignant · manipulation · salle</span><button type="button" class="btn btn-success btn-sm" data-v16-save-dirty-weeks style="margin-left:auto">Enregistrer les semaines modifiées</button></div><div data-v16-editor-status aria-live="polite" style="margin-top:8px"></div></div>`;}
  function findGroup(date,groupNo){for(const row of ctx.planningState?.rows||[]){if(row.date!==date)continue;const group=(row.groups||[]).find(g=>Number(g.groupNo)===Number(groupNo));if(group)return {row,group};}return null;}
  function markChanged(target,field){const date=target.getAttribute('data-date'),groupNo=Number(target.getAttribute('data-group'));const hit=findGroup(date,groupNo);if(!hit)return;const value=target.value;if(field==='teacher')hit.group.teacherId=value||null;else if(field==='manipulation')hit.group.manipulation=value||null;else if(field==='room')hit.group.room=value||null;dirtyWeeks.add(mondayFor(date));}
  function configure(options={}){ctx={...ctx,...options};return ctx;}
  function bindOnce(el,event,handler){
    if(!el||el.getAttribute('data-v16-editor-bound')==='true')return false;
    el.setAttribute('data-v16-editor-bound','true');
    el.addEventListener(event,handler);
    return true;
  }
  function bind(options={}){
    configure(options);const container=options.container;if(!container)return false;
    for(const el of container.querySelectorAll('[data-v16-edit-teacher]'))bindOnce(el,'change',()=>markChanged(el,'teacher'));
    for(const el of container.querySelectorAll('[data-v16-edit-manipulation]'))bindOnce(el,'change',()=>markChanged(el,'manipulation'));
    for(const el of container.querySelectorAll('[data-v16-edit-room]'))bindOnce(el,'change',()=>markChanged(el,'room'));
    const save=container.querySelector('[data-v16-save-dirty-weeks]');
    bindOnce(save,'click',async()=>{const status=container.querySelector('[data-v16-editor-status]');if(status)status.textContent='Validation et enregistrement…';try{const result=await saveDirtyWeeks();if(status)status.textContent=`${result.saved_weeks||0} semaine(s) enregistrée(s).`;}catch(error){if(status)status.innerHTML=`<div class="alert alert-danger">${esc(error?.message||error)}</div>`;}});
    return true;
  }
  function weekRows(weekStart){return (ctx.planningState?.rows||[]).filter(r=>r.isTeachingSession!==false&&r.className&&mondayFor(r.date)===weekStart);}
  function payloadFor(rows){return rows.flatMap(row=>(row.groups||[]).map(g=>({session_id:g.sessionId,group_no:Number(g.groupNo),teacher_id:g.teacherId,manipulation_code:g.manipulation,room:g.room})));}
  function validationError(blocker){const e=new Error(blocker?.message||blocker?.code||'Planning invalide.');e.code=blocker?.code||'VALIDATION_FAILED';e.blocker=blocker;return e;}
  async function saveDirtyWeeks(options={}){
    configure(options);if(!canUseAdminControls()&&options.isAdmin!==true)throw new Error('Accès Admin requis.');
    const client=options.supabaseClient||ctx.supabaseClient;if(!client)throw new Error('Connexion Supabase indisponible.');
    const allRows=ctx.planningState?.rows||[];
    const history=stateApi.validateManipulationHistory(allRows);if(history.length)throw validationError(history[0]);
    const teacherIds=(ctx.teachers||[]).map(t=>String(t.id));let saved=0;
    for(const weekStart of [...dirtyWeeks].sort()){
      const rows=weekRows(weekStart),validation=stateApi.validateWeek(rows,teacherIds);if(!validation.ok)throw validationError(validation.blockers[0]);
      const payload=payloadFor(rows);if(payload.some(r=>!r.session_id))throw validationError({code:'SESSION_ID_REQUIRED',message:'Identifiant de séance manquant : rechargez le planning avant d’enregistrer.'});
      const rpc=ctx.context==='test'?'v16_save_test_week_plan':'v16_save_week_plan';
      const args=ctx.context==='test'?{p_week_start:weekStart,p_rows:payload}:{p_week_start:weekStart,p_rows:payload,p_context:'real'};
      const {data,error}=await client.rpc(rpc,args);if(error)throw error;if(data?.ok===false)throw validationError(data.blockers?.[0]||data);
      dirtyWeeks.delete(weekStart);saved+=1;
    }
    if(typeof ctx.onSaved==='function')await ctx.onSaved();
    return {ok:true,saved_weeks:saved};
  }
  function resetDirty(){dirtyWeeks.clear();}
  function getDirtyWeeks(){return [...dirtyWeeks];}
  return {render,toolbar,bind,configure,saveDirtyWeeks,resetDirty,getDirtyWeeks,canUseAdminControls,mondayFor};
});
