(function(root){
  'use strict';
  function admin(){try{return Boolean(typeof currentTeacher!=='undefined'&&currentTeacher?.isAdmin);}catch(_){return false;}}
  function client(){try{return typeof supabaseClient!=='undefined'?supabaseClient:null;}catch(_){return null;}}
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function teacherName(state,id){return state.teachers?.find(t=>t.id===id)?.full_name||id;}
  function sessionLabel(s){return `${String(s.session_date||'')} — ${s.class_name||''}`;}
  async function rpc(name,args){const c=client();if(!c)throw new Error('Connexion Supabase indisponible.');const {data,error}=await c.rpc(name,args||{});if(error)throw error;return data;}
  function notify(m,t='info'){if(typeof showAlert==='function')showAlert(m,t);else alert(m);}

  function renderPanel(){
    if(!admin())return;
    const state=root.__V515_STATE,host=document.getElementById('v515-modal-body');
    if(!state?.cycle||!host||document.getElementById('v515-admin-assignment-panel'))return;
    const pending=(state.requests||[]).filter(r=>r.status==='pending');
    const sessions=state.sessions||[],assignments=state.assignments||[],groupCount=Number(state.cycle.group_count||4);
    const posts=[];
    for(const s of sessions.filter(x=>x.is_teaching_session&&['published','assignments_finalized'].includes(x.lifecycle_status))){
      for(let g=1;g<=groupCount;g++){
        if(assignments.some(a=>a.session_id===s.id&&Number(a.group_no)===g))continue;
        posts.push({session:s,groupNo:g,manipulation:root.V515Planning.manipulationFor(g,s.class_occurrence,6)});
      }
    }
    const panel=document.createElement('div');panel.id='v515-admin-assignment-panel';panel.style.cssText='margin:18px 0;padding:14px;border:1px solid #d7dce1;border-radius:8px';
    panel.innerHTML=`<h5>Validation des demandes et affectation directe</h5>`+
      (pending.length?`<div><strong>Demandes en attente</strong>${pending.map(r=>{const s=sessions.find(x=>x.id===r.session_id);return `<div style="display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid #eee"><span>${esc(teacherName(state,r.teacher_id))} — ${esc(sessionLabel(s||{}))} — G${Number(r.group_no)} ${esc(r.manipulation_code)}</span><button class="btn btn-sm btn-success" data-v515-validate-request="${r.id}">Valider</button></div>`;}).join('')}</div>`:'<div class="alert alert-info">Aucune demande en attente.</div>')+
      `<div style="margin-top:14px"><strong>Affectation directe Admin</strong><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px"><select id="v515-direct-post">${posts.map((p,i)=>`<option value="${i}">${esc(sessionLabel(p.session))} — G${p.groupNo} ${p.manipulation}</option>`).join('')}</select><select id="v515-direct-teacher">${(state.teachers||[]).map(t=>`<option value="${t.id}">${esc(t.full_name)}</option>`).join('')}</select><button class="btn btn-sm btn-primary" data-v515-direct-assign ${posts.length&&state.teachers?.length?'':'disabled'}>Affecter</button></div></div>`;
    host.insertBefore(panel,host.querySelector('h5[style]')||host.lastChild);

    for(const b of panel.querySelectorAll('[data-v515-validate-request]'))b.addEventListener('click',async()=>{
      try{const r=await rpc('v515_validate_request',{p_request_id:b.dataset.v515ValidateRequest});if(!r?.ok)throw new Error(r?.message||'Validation impossible.');notify('Demande validée.','success');await root.V515PlanningUI.render();}catch(e){notify(e.message||String(e),'danger');}
    });
    panel.querySelector('[data-v515-direct-assign]')?.addEventListener('click',async()=>{
      try{
        const idx=Number(document.getElementById('v515-direct-post').value),post=posts[idx],teacherId=document.getElementById('v515-direct-teacher').value;
        if(!post||!teacherId)throw new Error('Poste ou enseignant invalide.');
        const r=await rpc('v515_assign_teacher',{p_session_id:post.session.id,p_group_no:post.groupNo,p_manipulation_code:post.manipulation,p_teacher_id:teacherId});
        if(!r?.ok)throw new Error(r?.message||'Affectation impossible.');notify('Affectation directe enregistrée.','success');await root.V515PlanningUI.render();
      }catch(e){notify(e.message||String(e),'danger');}
    });
  }

  const observer=new MutationObserver(()=>setTimeout(renderPanel,0));
  if(document.documentElement)observer.observe(document.documentElement,{childList:true,subtree:true});
  root.V515PlanningAdminActions={renderPanel};
})(typeof globalThis!=='undefined'?globalThis:this);
