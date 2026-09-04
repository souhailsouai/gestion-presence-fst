(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.V16TestMode=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const KEY='v16_context';
  let context='real';
  let admin=false;
  let activeRole='teacher';
  let client=null;

  function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function valid(value){return value==='real'||value==='test';}
  function persisted(){try{const v=root.localStorage?.getItem(KEY);return valid(v)?v:'real';}catch(_){return 'real';}}
  function persist(value){try{root.localStorage?.setItem(KEY,value);}catch(_){/* noop */}}
  function emit(){try{if(typeof root.dispatchEvent==='function'&&typeof root.CustomEvent==='function')root.dispatchEvent(new root.CustomEvent('v16:context-changed',{detail:{context}}));}catch(_){/* noop */}}
  function configure(options={}){
    admin=options.isAdmin===true;
    activeRole=options.activeRole==='admin'?'admin':'teacher';
    client=options.supabaseClient||client||null;
    context=(admin&&activeRole==='admin')?(valid(options.context)?options.context:persisted()):'real';
    persist(context);
    return context;
  }
  function allowed(){return admin&&activeRole==='admin';}
  function getContext(){return allowed()?context:'real';}
  function setContext(value){if(!allowed()||!valid(value))return false;if(context===value)return true;context=value;persist(context);emit();return true;}
  function runtimeClient(){if(client)return client;try{return typeof supabaseClient!=='undefined'?supabaseClient:(root.supabaseClient||null);}catch(_){return root.supabaseClient||null;}}
  function requireAdminClient(options={}){if(!allowed())throw new Error('Accès Admin requis.');const c=options.supabaseClient||runtimeClient();if(!c)throw new Error('Connexion Supabase indisponible.');return c;}

  async function cloneRealToTest(effectiveDate,options={}){
    const c=requireAdminClient(options);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(effectiveDate||'')))throw new Error('Date d’effet requise.');
    const {data,error}=await c.rpc('v16_clone_real_to_test',{p_effective_date:effectiveDate});
    if(error)throw error;
    if(data&&data.ok===false)throw new Error(data.message||data.code||'Clonage TEST refusé.');
    return data||{ok:true};
  }

  async function resetTest(options={}){
    const c=requireAdminClient(options);
    const {data,error}=await c.rpc('v16_reset_test_context');
    if(error)throw error;
    if(data&&data.ok===false)throw new Error(data.message||data.code||'Réinitialisation refusée.');
    if(options.effectiveDate)return cloneRealToTest(options.effectiveDate,{supabaseClient:c});
    return data||{ok:true};
  }

  function structuralKey(row){return `${row.real_assignment_id||row.session_id||''}|${Number(row.group_no||0)}`;}
  function structuralValue(row){return [row.teacher_id||'',row.manipulation_code||'',row.room||''].join('|');}

  async function previewApply(effectiveDate,options={}){
    const c=requireAdminClient(options);
    const [testRes,realRes]=await Promise.all([
      c.from('v16_test_assignments').select('teacher_id,group_no,manipulation_code,room,test_session_id,real_assignment_id'),
      c.from('v515_assignments').select('teacher_id,group_no,manipulation_code,room,session_id')
    ]);
    if(testRes.error)throw testRes.error;if(realRes.error)throw realRes.error;
    const realById=new Map((realRes.data||[]).map(r=>[String(r.session_id)+'|'+Number(r.group_no),r]));
    let changed=0,unmapped=0;
    for(const t of testRes.data||[]){
      let r=null;
      if(t.real_assignment_id){
        r=(realRes.data||[]).find(x=>String(x.id||'')===String(t.real_assignment_id))||null;
      }
      if(!r)r=realById.get(String(t.test_session_id)+'|'+Number(t.group_no))||null;
      if(!r){unmapped+=1;continue;}
      if(structuralValue(t)!==structuralValue(r))changed+=1;
    }
    const blockers=unmapped?[{code:'UNMAPPED_TEST_ASSIGNMENT',message:`${unmapped} affectation(s) TEST non mappée(s).`}]:[];
    return {ok:!blockers.length,effective_date:effectiveDate,current_count:(realRes.data||[]).length,proposed_count:(testRes.data||[]).length,changed_count:changed,weeks:'Validation serveur à l’application',blockers,warnings:[]};
  }

  async function applyToReal(effectiveDate,options={}){
    const c=requireAdminClient(options);
    const {data,error}=await c.rpc('v16_apply_test_teacher_plan',{p_effective_date:effectiveDate});
    if(error)throw error;
    if(data&&data.ok===false)throw new Error(data.message||data.code||'Application refusée.');
    return data||{ok:true};
  }

  function render(options={}){
    const isAdmin=options.isAdmin===true,role=options.activeRole==='admin'?'admin':'teacher';
    if(!isAdmin||role!=='admin')return '';
    const ctx=valid(options.context)?options.context:context,isTest=ctx==='test';
    return `<section class="card" data-v16-test-mode="true" style="border:2px solid ${isTest?'#b91c1c':'#0a427e'};margin-bottom:18px">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap">
        <div><strong>MODE RÉEL ⇄ MODE TEST</strong><div style="font-size:.85rem;color:var(--gray)">Le mode TEST est isolé et réservé à l’Admin.</div></div>
        <span class="badge ${isTest?'badge-danger':'badge-present'}" data-v16-context-badge>${isTest?'MODE TEST':'MODE RÉEL'}</span>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        <button type="button" class="btn btn-primary btn-sm" data-v16-context="real">MODE RÉEL</button>
        <button type="button" class="btn btn-warning btn-sm" data-v16-context="test">MODE TEST</button>
        <button type="button" class="btn btn-danger btn-sm" data-v16-test-reset>Réinitialiser TEST</button>
      </div>
      <div data-v16-test-confirmation style="margin-top:12px"></div>
      <div class="card" style="margin-top:14px">
        <h3 style="margin-top:0">Application TEST → RÉEL</h3>
        <div class="form-row">
          <div class="form-group"><label>Date d’effet</label><input type="date" class="form-control" data-v16-apply-date></div>
          <div class="form-group"><label>Configuration actuelle</label><div class="form-control" data-v16-current-summary>—</div></div>
          <div class="form-group"><label>Configuration proposée</label><div class="form-control" data-v16-proposed-summary>—</div></div>
          <div class="form-group"><label>Semaines</label><div class="form-control" data-v16-weeks-summary>—</div></div>
          <div class="form-group"><label>Anomalies</label><div class="form-control" data-v16-anomalies-summary>—</div></div>
        </div>
        <button type="button" class="btn btn-info btn-sm" data-v16-test-clone>Cloner RÉEL → TEST</button>
        <button type="button" class="btn btn-info btn-sm" data-v16-apply-preview>Prévisualiser</button>
        <button type="button" class="btn btn-success btn-sm" data-v16-apply-confirm disabled>Appliquer au RÉEL</button>
      </div>
    </section>`;
  }

  function alertUser(message,type='info'){try{if(typeof showAlert==='function')showAlert(message,type);else if(root.showAlert)root.showAlert(message,type);}catch(_){/* noop */}}
  function updateBadge(mount){const badge=mount?.querySelector('[data-v16-context-badge]');if(badge)badge.textContent=context==='test'?'MODE TEST':'MODE RÉEL';}
  function bind(mount){
    if(!mount)return;
    for(const button of mount.querySelectorAll('[data-v16-context]'))button.addEventListener('click',()=>{const next=button.getAttribute('data-v16-context');if(setContext(next)){updateBadge(mount);alertUser(next==='test'?'MODE TEST activé.':'MODE RÉEL activé.',next==='test'?'warning':'success');}});
    mount.querySelector('[data-v16-test-reset]')?.addEventListener('click',async()=>{const box=mount.querySelector('[data-v16-test-confirmation]');if(box)box.textContent='Réinitialisation TEST en cours…';try{await resetTest();if(box)box.textContent='Contexte TEST réinitialisé.';alertUser('Contexte TEST réinitialisé.','success');}catch(error){if(box)box.textContent=error?.message||String(error);alertUser(error?.message||String(error),'danger');}});
    mount.querySelector('[data-v16-test-clone]')?.addEventListener('click',async()=>{const date=mount.querySelector('[data-v16-apply-date]')?.value||'';if(!date){alertUser('Choisissez une date d’effet.','warning');return;}try{const r=await cloneRealToTest(date);alertUser(`RÉEL cloné vers TEST : ${r.assignments??0} affectation(s).`,'success');}catch(error){alertUser(error?.message||String(error),'danger');}});
    mount.querySelector('[data-v16-apply-preview]')?.addEventListener('click',async()=>{const date=mount.querySelector('[data-v16-apply-date]')?.value||'';if(!date){alertUser('Choisissez une date d’effet.','warning');return;}try{const p=await previewApply(date);mount.querySelector('[data-v16-current-summary]').textContent=String(p.current_count??'—');mount.querySelector('[data-v16-proposed-summary]').textContent=`${p.proposed_count??'—'} (${p.changed_count??0} changement(s))`;mount.querySelector('[data-v16-weeks-summary]').textContent=String(p.weeks??'À valider côté serveur');mount.querySelector('[data-v16-anomalies-summary]').textContent=(p.blockers||[]).length?`${p.blockers.length} blocage(s)`:'Aucune anomalie détectée dans la prévisualisation.';const confirm=mount.querySelector('[data-v16-apply-confirm]');if(confirm)confirm.disabled=Boolean((p.blockers||[]).length);}catch(error){alertUser(error?.message||String(error),'danger');}});
    mount.querySelector('[data-v16-apply-confirm]')?.addEventListener('click',async()=>{const date=mount.querySelector('[data-v16-apply-date]')?.value||'';if(!date)return;try{const r=await applyToReal(date);alertUser(`Application vers RÉEL terminée : ${r.affected_sessions??0} affectation(s).`,'success');}catch(error){alertUser(error?.message||String(error),'danger');}});
  }
  function mount(options={}){
    if(typeof document==='undefined')return false;
    const roleApi=options.activeRoleApi||root.V16ActiveRole,isAdmin=Boolean(options.isAdmin??roleApi?.isAdminAccount?.()),role=options.activeRole||roleApi?.get?.()||'teacher';
    configure({isAdmin,activeRole:role,supabaseClient:options.supabaseClient});
    let host=document.getElementById('v16-test-mode-root');
    if(!host){const planning=document.getElementById('v16-planning-root');if(!planning)return false;host=document.createElement('div');host.id='v16-test-mode-root';planning.insertAdjacentElement('beforebegin',host);}
    host.innerHTML=render({isAdmin,activeRole:role,context});bind(host);return true;
  }

  return {configure,getContext,setContext,resetTest,cloneRealToTest,render,previewApply,applyToReal,mount};
});
