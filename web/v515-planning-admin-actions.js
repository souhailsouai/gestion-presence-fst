(function(root){
  'use strict';
  const manipulationRooms={M1:'C',M2:'B',M3:'D',M4:'D',M5:'A',M6:'A'};
  function admin(){try{return Boolean(typeof currentTeacher!=='undefined'&&currentTeacher?.isAdmin);}catch(_){return false;}}
  function client(){try{return typeof supabaseClient!=='undefined'?supabaseClient:null;}catch(_){return null;}}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function fixedRoom(m){return manipulationRooms[m]||null;}
  function teacherName(state,id){return state.teachers?.find(t=>t.id===id)?.full_name||'Non affecté';}
  function sessionLabel(s){return `${String(s.session_date||'')} — ${s.class_name||''}`;}
  function sessionStarted(s){if(!s?.session_date||!s?.start_time)return false;return Date.now()>=new Date(`${s.session_date}T${String(s.start_time).slice(0,8)}`).getTime();}
  function weekdayFor(state,s){return state.classPairs?.find(p=>p.id===s.pair_id)?.weekday||null;}
  function teacherPool(state,s){const weekday=weekdayFor(state,s),allowed=new Set((state.teacherPool||[]).filter(p=>p.weekday===weekday&&p.active!==false).map(p=>p.teacher_id));return (state.teachers||[]).filter(t=>allowed.has(t.id));}
  async function rpc(name,args){const c=client();if(!c)throw new Error('Connexion Supabase indisponible.');const {data,error}=await c.rpc(name,args||{});if(error)throw error;return data;}
  function notify(m,t='info'){if(typeof showAlert==='function')showAlert(m,t);else alert(m);}

  function renderPanel(){
    if(!admin())return;
    const state=root.__V515_STATE,host=document.getElementById('v515-modal-body');
    if(!state?.cycle||!host||document.getElementById('v515-admin-assignment-panel'))return;
    const sessions=(state.sessions||[]).filter(x=>x.is_teaching_session&&['published','assignments_finalized'].includes(x.lifecycle_status));
    const groupCount=Number(state.cycle.group_count||4),assignments=state.assignments||[];
    const rows=[];
    for(const s of sessions){for(let g=1;g<=groupCount;g++){
      const manipulation=root.V515Planning.manipulationFor(g,s.class_occurrence,6),assignment=assignments.find(a=>a.session_id===s.id&&Number(a.group_no)===g),pool=teacherPool(state,s),started=sessionStarted(s);
      rows.push({session:s,groupNo:g,manipulation,room:fixedRoom(manipulation),assignment,pool,started});
    }}
    const notMaterialized=assignments.filter(a=>!a.legacy_plan_id).length;
    const panel=document.createElement('div');panel.id='v515-admin-assignment-panel';panel.style.cssText='margin:18px 0;padding:14px;border:1px solid #d7dce1;border-radius:8px';
    panel.innerHTML=`<h5>Arrangement des enseignants — planning PDF</h5><p class="text-muted">L’Admin choisit l’enseignant pour chaque groupe. La salle et la manipulation suivent le PDF. Une séance démarrée est verrouillée.</p>`+
      (rows.length?`<div style="overflow:auto"><table class="table" style="min-width:920px"><thead><tr><th>Date / classe</th><th>Groupe</th><th>Manip.</th><th>Salle</th><th>Enseignant</th><th>Action</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${esc(sessionLabel(r.session))}</td><td>G${r.groupNo}</td><td>${esc(r.manipulation)}</td><td>${esc(r.room)}</td><td><select id="v515-teacher-${i}" ${r.started?'disabled':''}>${r.pool.map(t=>`<option value="${t.id}" ${r.assignment?.teacher_id===t.id?'selected':''}>${esc(t.full_name)}</option>`).join('')}</select>${r.assignment?`<div><small>Actuel : ${esc(teacherName(state,r.assignment.teacher_id))}</small></div>`:''}</td><td>${r.started?'<span class="badge badge-secondary">Séance démarrée</span>':`<button class="btn btn-sm btn-primary" data-v515-direct-assign="${i}" ${r.pool.length?'':'disabled'}>${r.assignment?'Modifier':'Affecter'}</button>`}</td></tr>`).join('')}</tbody></table></div>`:'<div class="alert alert-info">Publiez d’abord le planning pour organiser les enseignants.</div>')+
      (state.cycle.status==='assignments_finalized'?`<div style="margin-top:16px;border-top:1px solid #ddd;padding-top:12px"><strong>Intégration présence/notes</strong><p>${notMaterialized?`${notMaterialized} affectation(s) ne sont pas encore activées dans le planning de présence.`:'Le planning V5.15 est activé dans le module présence.'}</p>${notMaterialized?'<button class="btn btn-success" data-v515-materialize>Activer dans présence</button>':''}</div>`:'');
    const anchor=document.getElementById('v515-admin-anchor');if(anchor)anchor.appendChild(panel);else host.appendChild(panel);

    for(const b of panel.querySelectorAll('[data-v515-direct-assign]'))b.addEventListener('click',async()=>{
      try{
        const idx=Number(b.dataset.v515DirectAssign),row=rows[idx],teacherId=document.getElementById(`v515-teacher-${idx}`)?.value;
        if(!row||row.started)throw new Error('Séance démarrée : modification interdite.');
        if(!teacherId||!row.room)throw new Error('Enseignant ou salle invalide.');
        const r=await rpc('v515_assign_teacher',{p_session_id:row.session.id,p_group_no:row.groupNo,p_manipulation_code:row.manipulation,p_teacher_id:teacherId,p_room:row.room});
        if(!r?.ok)throw new Error(r?.message||'Affectation impossible.');
        notify(r.updated?'Enseignant modifié.':'Affectation enregistrée.','success');await root.V515PlanningUI.render();
      }catch(e){notify(e.message||String(e),'danger');}
    });
    panel.querySelector('[data-v515-materialize]')?.addEventListener('click',async()=>{
      try{const r=await rpc('v515_materialize_session_plans',{p_cycle_id:state.cycle.id});if(!r?.ok)throw new Error(r?.message||'Activation impossible.');notify(`${r.plans} plan(s) V5.15 activé(s) dans présence.`,'success');await root.V515PlanningUI.render();}catch(e){notify(e.message||String(e),'danger');}
    });
  }

  const observer=new MutationObserver(()=>setTimeout(renderPanel,0));if(document.documentElement)observer.observe(document.documentElement,{childList:true,subtree:true});
  root.V515PlanningAdminActions={renderPanel,teacherPool,sessionStarted};
})(typeof globalThis!=='undefined'?globalThis:this);
