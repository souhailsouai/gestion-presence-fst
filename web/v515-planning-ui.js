(function(root){
  'use strict';
  const planning=root.V515Planning,seed=root.V515PlanningData,validator=root.V515PlanningValidation;
  if(!planning||!seed||!validator)return;

  function teacher(){try{return typeof currentTeacher!=='undefined'?currentTeacher:null;}catch(_){return null;}}
  function client(){try{return typeof supabaseClient!=='undefined'?supabaseClient:null;}catch(_){return null;}}
  function isAdmin(){return Boolean(teacher()?.isAdmin);}
  function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function fmtDate(v){const [y,m,d]=String(v||'').split('-');return y&&m&&d?`${d}/${m}/${y}`:String(v||'');}
  function notify(message,type='info'){if(typeof showAlert==='function')showAlert(message,type);else window.alert(message);}

  async function rpc(name,args={}){
    const c=client();if(!c)throw new Error('Connexion Supabase indisponible.');
    const {data,error}=await c.rpc(name,args);if(error)throw error;return data;
  }

  async function loadState(){
    const c=client();
    if(!c)return {cycle:null,sessions:[],constraints:[],requests:[],assignments:[],teachers:[]};
    const cycleRes=await c.from('v515_cycles').select('*').eq('academic_year','2026/2027').eq('semester',1).maybeSingle();
    if(cycleRes.error)throw cycleRes.error;
    const cycle=cycleRes.data;
    if(!cycle)return {cycle:null,sessions:[],constraints:[],requests:[],assignments:[],teachers:[]};
    const [sessionsRes,constraintsRes,requestsRes,assignmentsRes]=await Promise.all([
      c.from('v515_sessions').select('*').eq('cycle_id',cycle.id).order('session_date').order('start_time'),
      c.from('v515_teacher_constraints').select('*').eq('cycle_id',cycle.id),
      c.from('v515_requests').select('*').eq('cycle_id',cycle.id),
      c.from('v515_assignments').select('*').eq('cycle_id',cycle.id)
    ]);
    for(const r of [sessionsRes,constraintsRes,requestsRes,assignmentsRes])if(r.error)throw r.error;
    let teachers=[];
    if(isAdmin()){
      const t=await c.from('profiles').select('id,full_name,role').in('role',['teacher','admin']).is('deleted_at',null).order('full_name');
      if(!t.error)teachers=t.data||[];
    }
    return {cycle,sessions:sessionsRes.data||[],constraints:constraintsRes.data||[],requests:requestsRes.data||[],assignments:assignmentsRes.data||[],teachers};
  }

  function referenceRows(){return seed.calendarRows.slice().sort((a,b)=>a.date.localeCompare(b.date));}

  function remotePlanningState(state){
    if(!state.cycle)return {sessions:[],completeness:[],assignmentPosts:[],rotationConsistent:true,groupCount:4,manipulationCount:6};
    const groupCount=Number(state.cycle.group_count||4);
    const sessions=state.sessions.map(s=>({
      id:s.id,date:s.session_date,slot:`${String(s.start_time).slice(0,5)}-${String(s.end_time).slice(0,5)}`,
      className:s.class_name,isTeachingSession:s.is_teaching_session,classOccurrence:s.class_occurrence,
      completedAt:s.completed_at,pendingMutation:false,
      groups:s.is_teaching_session?Array.from({length:groupCount},(_,i)=>({groupNo:i+1,manipulation:planning.manipulationFor(i+1,s.class_occurrence,6)})):[]
    }));
    const classes=[...new Set(sessions.filter(s=>s.isTeachingSession).map(s=>s.className))];
    const completeness=classes.map(className=>{
      const c=planning.completeness(sessions,className,groupCount,6);
      return {className,groups:Object.entries(c.groups).map(([groupNo,g])=>({groupNo:Number(groupNo),completed:g.completed,missing:g.missing,duplicates:g.duplicates}))};
    });
    const assignmentPosts=[];
    for(const s of sessions.filter(x=>x.isTeachingSession))for(let g=1;g<=groupCount;g++){
      const a=state.assignments.find(x=>x.session_id===s.id&&Number(x.group_no)===g);
      assignmentPosts.push({id:`${s.id}:${g}`,teacherId:a?.teacher_id||null,manipulation:planning.manipulationFor(g,s.classOccurrence,6),quotaExceeded:false,manipulationAllowed:true,timeConflict:false,duplicateAssignment:false});
    }
    return {sessions,completeness,assignmentPosts,rotationConsistent:true,groupCount,manipulationCount:6};
  }

  function resultHtml(result){
    const block=result.blockers||[],warn=result.warnings||[];
    return `<div class="v515-check"><strong>Contrôle :</strong> ${block.length} bloquante(s), ${warn.length} avertissement(s)`+
      (block.length?`<ul>${block.map(x=>`<li style="color:#b02a37">${esc(x.message)}</li>`).join('')}</ul>`:'')+
      (warn.length?`<ul>${warn.map(x=>`<li style="color:#8a5b00">${esc(x.message)}</li>`).join('')}</ul>`:'')+'</div>';
  }

  function referenceTable(){
    return `<div style="overflow:auto"><table class="table" style="min-width:760px"><thead><tr><th>Date</th><th>Classe</th><th>G1</th><th>G2</th><th>G3</th><th>G4</th></tr></thead><tbody>`+
      referenceRows().map(r=>`<tr><td>${fmtDate(r.date)}</td><td>${esc(r.className||r.reason||'Aucun TP')}</td>${r.isTeachingSession?r.groups.map(g=>`<td>${esc(g.manipulation)}</td>`).join(''):'<td>—</td><td>—</td><td>—</td><td>—</td>'}</tr>`).join('')+
      `</tbody></table></div>`;
  }

  function teacherActions(state){
    if(!state.cycle)return '<div class="alert alert-warning">Le planning V5.15 n’est pas encore initialisé par un administrateur.</div>';
    const me=teacher();
    const constraint=state.constraints.find(x=>x.teacher_id===me?.id);
    const assigned=state.assignments.filter(x=>x.teacher_id===me?.id).length;
    let html=`<div class="alert alert-info"><strong>Quota :</strong> ${assigned}/${constraint?.quota??0} — <strong>Manipulations autorisées :</strong> ${esc((constraint?.allowed_manipulations||[]).join(', ')||'aucune')}</div>`;
    if(state.cycle.status!=='published')return html+'<div class="alert alert-warning">Les demandes seront disponibles après publication du planning.</div>';
    const today=new Date().toISOString().slice(0,10);
    for(const s of state.sessions.filter(x=>x.is_teaching_session&&x.lifecycle_status==='published'&&x.session_date>=today)){
      const actions=[];
      for(let g=1;g<=Number(state.cycle.group_count);g++){
        const manip=planning.manipulationFor(g,s.class_occurrence,6);
        if(!(constraint?.allowed_manipulations||[]).includes(manip))continue;
        const ownRequest=state.requests.find(r=>r.teacher_id===me?.id&&r.session_id===s.id&&Number(r.group_no)===g&&r.status==='pending');
        const assignment=state.assignments.find(a=>a.session_id===s.id&&Number(a.group_no)===g);
        if(assignment){if(assignment.teacher_id===me?.id)actions.push(`<span class="badge badge-success">G${g} ${manip} affecté</span>`);continue;}
        if(ownRequest)actions.push(`<button class="btn btn-sm btn-outline-danger" data-v515-cancel="${ownRequest.id}">Annuler G${g} ${manip}</button>`);
        else actions.push(`<button class="btn btn-sm btn-outline-primary" data-v515-request="${s.id}" data-group="${g}" data-manip="${manip}">Demander G${g} ${manip}</button>`);
      }
      if(actions.length)html+=`<div style="padding:10px 0;border-bottom:1px solid #ddd"><strong>${fmtDate(s.session_date)} — ${esc(s.class_name)}</strong><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">${actions.join('')}</div></div>`;
    }
    return html;
  }

  function adminActions(state){
    if(!state.cycle)return `<button class="btn btn-primary" data-v515-init>Initialiser le planning 2026/2027</button>`;
    const plan=remotePlanningState(state),check=validator.verify(plan),fin=validator.canFinalizeAssignments(check,plan);
    let html=`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><span class="badge badge-info">État : ${esc(state.cycle.status)}</span>`;
    if(state.cycle.status==='draft')html+=`<button class="btn btn-success" data-v515-publish ${check.blockers.length?'disabled':''}>Publier</button>`;
    if(state.cycle.status==='published')html+=`<button class="btn btn-success" data-v515-finalize ${fin.ok?'':'disabled'}>Finaliser les affectations</button>`;
    html+=`<button class="btn btn-secondary" data-v515-verify>Vérifier le planning</button></div>`+resultHtml(check);
    html+=`<div style="margin:12px 0"><label><strong>Nombre de groupes :</strong> <input id="v515-group-count" type="number" min="1" max="6" value="${Number(state.cycle.group_count)}" style="width:70px"></label> <button class="btn btn-sm btn-outline-primary" data-v515-groups>Appliquer</button></div>`;
    if(state.teachers.length){
      html+=`<div style="border-top:1px solid #ddd;padding-top:12px"><strong>Quota et manipulations autorisées</strong><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px"><select id="v515-teacher">${state.teachers.map(t=>`<option value="${t.id}">${esc(t.full_name)}</option>`).join('')}</select><input id="v515-quota" type="number" min="0" value="2" style="width:70px">${[1,2,3,4,5,6].map(n=>`<label><input type="checkbox" class="v515-manip" value="M${n}"> M${n}</label>`).join('')}<button class="btn btn-sm btn-outline-primary" data-v515-constraint>Enregistrer</button></div></div>`;
    }
    return html;
  }

  async function render(){
    const body=document.getElementById('v515-modal-body');if(!body)return;
    body.innerHTML='<div class="alert alert-info">Chargement…</div>';
    try{
      const state=await loadState();
      root.__V515_STATE=state;
      body.innerHTML=`<h4>Planning TP 2026/2027 — V5.15</h4>${isAdmin()?adminActions(state):teacherActions(state)}<h5 style="margin-top:18px">Planning de référence</h5>${referenceTable()}<div class="alert alert-warning" style="margin-top:12px">Les salles ne sont pas importées automatiquement : les notes des fichiers source sont contradictoires sur l’affectation Manipulation → Salle.</div>`;
      bind();
    }catch(e){body.innerHTML=`<div class="alert alert-danger">${esc(e.message||e)}</div>${referenceTable()}`;}
  }

  async function act(fn){try{await fn();await render();}catch(e){notify(e.message||String(e),'danger');}}
  function bind(){
    document.querySelector('[data-v515-init]')?.addEventListener('click',()=>act(async()=>{const r=await rpc('v515_initialize_2026_2027');if(!r?.ok)throw new Error(r?.message||'Initialisation impossible.');notify('Planning V5.15 initialisé en brouillon.','success');}));
    document.querySelector('[data-v515-publish]')?.addEventListener('click',()=>act(async()=>{const r=await rpc('v515_publish_cycle',{p_cycle_id:root.__V515_STATE.cycle.id});if(!r?.ok)throw new Error(r?.message||'Publication impossible.');notify('Planning publié.','success');}));
    document.querySelector('[data-v515-finalize]')?.addEventListener('click',()=>act(async()=>{const r=await rpc('v515_finalize_assignments',{p_cycle_id:root.__V515_STATE.cycle.id});if(!r?.ok)throw new Error(r?.message||'Finalisation impossible.');notify('Affectations finalisées.','success');}));
    document.querySelector('[data-v515-groups]')?.addEventListener('click',()=>act(async()=>{const n=Number(document.getElementById('v515-group-count').value);const r=await rpc('v515_set_group_count',{p_cycle_id:root.__V515_STATE.cycle.id,p_group_count:n});if(!r?.ok)throw new Error(r?.message||'Modification impossible.');}));
    document.querySelector('[data-v515-constraint]')?.addEventListener('click',()=>act(async()=>{const teacherId=document.getElementById('v515-teacher').value,quota=Number(document.getElementById('v515-quota').value),allowed=[...document.querySelectorAll('.v515-manip:checked')].map(x=>x.value);const r=await rpc('v515_set_teacher_constraints',{p_cycle_id:root.__V515_STATE.cycle.id,p_teacher_id:teacherId,p_quota:quota,p_allowed_manipulations:allowed});if(!r?.ok)throw new Error(r?.message||'Enregistrement impossible.');notify('Contraintes enseignant enregistrées.','success');}));
    for(const b of document.querySelectorAll('[data-v515-request]'))b.addEventListener('click',()=>act(async()=>{const r=await rpc('v515_request_assignment',{p_session_id:b.dataset.v515Request,p_group_no:Number(b.dataset.group),p_manipulation_code:b.dataset.manip});if(!r?.ok)throw new Error(r?.message||'Demande impossible.');notify('Demande enregistrée.','success');}));
    for(const b of document.querySelectorAll('[data-v515-cancel]'))b.addEventListener('click',()=>act(async()=>{const r=await rpc('v515_cancel_request',{p_request_id:b.dataset.v515Cancel});if(!r?.ok)throw new Error(r?.message||'Annulation impossible.');notify('Demande annulée.','success');}));
    document.querySelector('[data-v515-verify]')?.addEventListener('click',()=>{const state=root.__V515_STATE,check=validator.verify(remotePlanningState(state));notify(check.blockers.length?`${check.blockers.length} anomalie(s) bloquante(s).`:`Aucune anomalie bloquante. ${check.warnings.length} avertissement(s).`,check.blockers.length?'danger':'success');});
  }

  function open(){
    if(!document.getElementById('v515-modal')){
      const modal=document.createElement('div');modal.id='v515-modal';modal.innerHTML=`<div style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:99998" data-v515-close></div><div style="position:fixed;z-index:99999;inset:5%;background:#fff;border-radius:10px;padding:18px;overflow:auto;box-shadow:0 10px 40px rgba(0,0,0,.3)"><button class="btn btn-sm btn-secondary" style="float:right" data-v515-close>Fermer</button><div id="v515-modal-body"></div></div>`;document.body.appendChild(modal);
      for(const x of modal.querySelectorAll('[data-v515-close]'))x.addEventListener('click',()=>modal.remove());
    }
    render();
  }

  function injectLauncher(){
    if(document.getElementById('v515-launcher'))return;
    const b=document.createElement('button');b.id='v515-launcher';b.type='button';b.textContent='Planning V5.15';b.className='btn btn-primary';b.style.cssText='position:fixed;right:18px;bottom:18px;z-index:9000;box-shadow:0 4px 14px rgba(0,0,0,.2)';b.addEventListener('click',open);document.body.appendChild(b);
  }

  root.V515PlanningUI={open,render,loadState,remotePlanningState};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',injectLauncher);else injectLauncher();
})(typeof globalThis!=='undefined'?globalThis:this);
