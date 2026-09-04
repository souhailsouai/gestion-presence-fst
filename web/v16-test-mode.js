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
  function weekStart(value){
    const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return '';
    const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));const day=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()-(day-1));return d.toISOString().slice(0,10);
  }
  function persisted(){try{const v=root.localStorage?.getItem(KEY);return valid(v)?v:'real';}catch(_){return 'real';}}
  function persist(value){try{root.localStorage?.setItem(KEY,value);}catch(_){/* noop */}}
  function emit(){
    try{if(typeof root.dispatchEvent==='function'&&typeof root.CustomEvent==='function')root.dispatchEvent(new root.CustomEvent('v16:context-changed',{detail:{context}}));}catch(_){/* noop */}
  }
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
  function setContext(value){
    if(!allowed()||!valid(value))return false;
    if(context===value)return true;
    context=value;persist(context);emit();return true;
  }
  function runtimeClient(){
    if(client)return client;
    try{return typeof supabaseClient!=='undefined'?supabaseClient:(root.supabaseClient||null);}catch(_){return root.supabaseClient||null;}
  }
  function validatePreviewWeeks(scoped,testSessions,teacherIds){
    const blockers=[];
    if(teacherIds.length!==6)return blockers;
    const sessionById=new Map((testSessions||[]).map(s=>[String(s.id),s]));
    const weeks=new Map();
    for(const a of scoped||[]){
      const s=sessionById.get(String(a.test_session_id||''));
      if(!s||!s.session_date||s.lifecycle_status==='cancelled'||!s.class_name)continue;
      const key=weekStart(s.session_date);if(!key)continue;
      if(!weeks.has(key))weeks.set(key,new Map());
      const days=weeks.get(key);if(!days.has(s.session_date))days.set(s.session_date,[]);days.get(s.session_date).push(a);
    }
    for(const [week,days] of weeks){
      for(const [date,assignments] of days){
        const ids=assignments.map(a=>String(a.teacher_id||'')).filter(Boolean);
        if(assignments.length!==4||ids.length!==4||new Set(ids).size!==4)blockers.push({code:'DAY_TEACHER_COUNT',week_start:week,date,message:'Chaque jour TEST doit avoir exactement 4 enseignants distincts.'});
        const rooms=assignments.map(a=>String(a.room||'')).filter(Boolean);
        if(rooms.length!==4)blockers.push({code:'ROOM_REQUIRED',week_start:week,date,message:'Toutes les salles TEST doivent être choisies.'});
        else if(new Set(rooms).size!==4)blockers.push({code:'ROOM_TIME_CONFLICT',week_start:week,date,message:'Deux groupes TEST simultanés ne peuvent pas utiliser la même salle.'});
      }
      const daysByTeacher=new Map(teacherIds.map(id=>[String(id),new Set()]));
      for(const [date,assignments] of days)for(const id of new Set(assignments.map(a=>String(a.teacher_id||'')).filter(Boolean))){
        if(!daysByTeacher.has(id))blockers.push({code:'UNAUTHORIZED_TEACHER',week_start:week,teacher_id:id,message:'Un enseignant TEST n’est pas autorisé pour ce cycle.'});
        else daysByTeacher.get(id).add(date);
      }
      const counts=teacherIds.map(id=>daysByTeacher.get(String(id))?.size||0);
      for(let i=0;i<teacherIds.length;i++)if(counts[i]>2)blockers.push({code:'MAX_TWO_DAYS_PER_TEACHER',week_start:week,teacher_id:String(teacherIds[i]),days:counts[i],message:'Aucun enseignant ne peut dépasser 2 jours de TP par semaine.'});
      const used=counts.filter(n=>n>0).length;
      if(used!==6)blockers.push({code:'WEEK_TEACHER_COUNT',week_start:week,teachers:used,message:'La semaine TEST doit mobiliser les 6 enseignants.'});
      if(days.size===3&&counts.some(n=>n!==2))blockers.push({code:'TEACHER_WEEKDAY_COUNT',week_start:week,message:'En semaine normale TEST, chaque enseignant doit intervenir exactement 2 jours.'});
      else if(days.size===2&&counts.slice().sort((a,b)=>b-a).join(',')!=='2,2,1,1,1,1')blockers.push({code:'HOLIDAY_WEEK_DISTRIBUTION',week_start:week,message:'Semaine réduite TEST : répartition attendue 2,2,1,1,1,1.'});
      else if(![2,3].includes(days.size))blockers.push({code:'TEACHING_DAY_COUNT_UNSUPPORTED',week_start:week,days:days.size,message:'La semaine TEST doit contenir 3 jours de TP ou 2 jours après jour férié.'});
    }
    return blockers;
  }
  async function clearTest(options={}){
    if(!allowed())throw new Error('Accès Admin requis.');
    const c=options.supabaseClient||runtimeClient();
    if(!c)throw new Error('Connexion Supabase indisponible.');
    const {data,error}=await c.rpc('v16_reset_test_context');
    if(error)throw error;
    if(data&&data.ok===false)throw new Error(data.message||data.code||'Réinitialisation refusée.');
    return data||{ok:true};
  }
  async function cloneRealToTest(effectiveDate,options={}){
    if(!allowed())throw new Error('Accès Admin requis.');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(effectiveDate||'')))throw new Error('Date d’effet requise.');
    const c=options.supabaseClient||runtimeClient();
    if(!c)throw new Error('Connexion Supabase indisponible.');
    const {data,error}=await c.rpc('v16_clone_real_to_test',{p_effective_date:effectiveDate});
    if(error)throw error;
    if(data&&data.ok===false)throw new Error(data.message||data.code||'Clonage TEST refusé.');
    emit();
    return data||{ok:true};
  }
  async function resetTest(options={}){
    const effectiveDate=options.effectiveDate||'';
    if(!effectiveDate)return clearTest(options);
    return cloneRealToTest(effectiveDate,options);
  }
  async function previewApply(effectiveDate,options={}){
    if(!allowed())throw new Error('Accès Admin requis.');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(effectiveDate||'')))throw new Error('Date d’effet requise.');
    const c=options.supabaseClient||runtimeClient();
    if(!c)throw new Error('Connexion Supabase indisponible.');
    const [testRes,testSessionsRes,realRes,constraintsRes]=await Promise.all([
      c.from('v16_test_assignments').select('teacher_id,group_no,manipulation_code,room,test_session_id,real_assignment_id'),
      c.from('v16_test_sessions').select('id,real_session_id,session_date,class_name,lifecycle_status'),
      c.from('v515_assignments').select('teacher_id,group_no,manipulation_code,room,session_id,id'),
      c.from('v515_teacher_constraints').select('teacher_id')
    ]);
    if(testRes.error)throw testRes.error;
    if(testSessionsRes.error)throw testSessionsRes.error;
    if(realRes.error)throw realRes.error;
    if(constraintsRes.error)throw constraintsRes.error;
    const sessionDates=new Map((testSessionsRes.data||[]).map(s=>[String(s.id),String(s.session_date||'')]));
    const scoped=(testRes.data||[]).filter(t=>{
      const date=sessionDates.get(String(t.test_session_id||''))||'';
      return date&&date>=effectiveDate;
    });
    const realById=new Map((realRes.data||[]).map(r=>[String(r.id),r]));
    let structuralChanges=0;
    for(const t of scoped){
      const r=realById.get(String(t.real_assignment_id||''));
      if(!r)continue;
      if(String(t.teacher_id)!==String(r.teacher_id)||t.manipulation_code!==r.manipulation_code||t.room!==r.room)structuralChanges+=1;
    }
    const proposed=scoped.length;
    const current=scoped.filter(t=>realById.has(String(t.real_assignment_id||''))).length;
    const weeks=new Set(scoped.map(t=>weekStart(sessionDates.get(String(t.test_session_id||'')))).filter(Boolean)).size;
    const teacherIds=[...new Set((constraintsRes.data||[]).map(t=>String(t.teacher_id||'')).filter(Boolean))];
    const blockers=[];
    for(const t of scoped)if(!t.real_assignment_id||!realById.has(String(t.real_assignment_id)))blockers.push({code:'UNMAPPED_TEST_ASSIGNMENT',message:'Une affectation TEST ne correspond à aucune affectation RÉEL.'});
    blockers.push(...validatePreviewWeeks(scoped,testSessionsRes.data||[],teacherIds));
    return {ok:blockers.length===0,effective_date:effectiveDate,current_count:current,proposed_count:proposed,structural_changes:structuralChanges,weeks,blockers,warnings:[]};
  }
  async function applyToReal(effectiveDate,options={}){
    if(!allowed())throw new Error('Accès Admin requis.');
    const c=options.supabaseClient||runtimeClient();
    if(!c)throw new Error('Connexion Supabase indisponible.');
    const {data,error}=await c.rpc('v16_apply_test_teacher_plan',{p_effective_date:effectiveDate});
    if(error)throw error;
    if(data&&data.ok===false)throw new Error(data.message||data.code||'Application refusée.');
    return data||{ok:true};
  }
  function render(options={}){
    const isAdmin=options.isAdmin===true;
    const role=options.activeRole==='admin'?'admin':'teacher';
    if(!isAdmin||role!=='admin')return '';
    const ctx=valid(options.context)?options.context:context;
    const isTest=ctx==='test';
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
        <button type="button" class="btn btn-info btn-sm" data-v16-apply-preview>Prévisualiser</button>
        <button type="button" class="btn btn-success btn-sm" data-v16-apply-confirm disabled>Appliquer au RÉEL</button>
      </div>
    </section>`;
  }

  function alertUser(message,type='info'){
    try{if(typeof showAlert==='function')showAlert(message,type);else if(root.showAlert)root.showAlert(message,type);}catch(_){/* noop */}
  }
  function updateBadge(mount){
    const badge=mount?.querySelector('[data-v16-context-badge]');
    if(badge)badge.textContent=context==='test'?'MODE TEST':'MODE RÉEL';
  }
  function bind(mount){
    if(!mount)return;
    for(const button of mount.querySelectorAll('[data-v16-context]'))button.addEventListener('click',()=>{
      const next=button.getAttribute('data-v16-context');
      if(setContext(next)){updateBadge(mount);alertUser(next==='test'?'MODE TEST activé.':'MODE RÉEL activé.',next==='test'?'warning':'success');}
    });
    mount.querySelector('[data-v16-test-reset]')?.addEventListener('click',async()=>{
      const box=mount.querySelector('[data-v16-test-confirmation]');
      const date=mount.querySelector('[data-v16-apply-date]')?.value||'';
      if(!date){alertUser('Choisissez une date d’effet pour recréer le TEST depuis le RÉEL.','warning');return;}
      if(box)box.textContent='Réinitialisation et clonage TEST en cours…';
      try{const r=await resetTest({effectiveDate:date});if(box)box.textContent=`TEST recréé : ${r.assignments??0} affectation(s).`;alertUser('Contexte TEST recréé depuis le RÉEL.','success');}
      catch(error){if(box)box.textContent=error?.message||String(error);alertUser(error?.message||String(error),'danger');}
    });
    mount.querySelector('[data-v16-apply-preview]')?.addEventListener('click',async()=>{
      const date=mount.querySelector('[data-v16-apply-date]')?.value||'';
      if(!date){alertUser('Choisissez une date d’effet.','warning');return;}
      try{
        const p=await previewApply(date);
        mount.querySelector('[data-v16-current-summary]').textContent=String(p.current_count??'—');
        mount.querySelector('[data-v16-proposed-summary]').textContent=String(p.proposed_count??'—');
        mount.querySelector('[data-v16-weeks-summary]').textContent=String(p.weeks??'À valider côté serveur');
        mount.querySelector('[data-v16-anomalies-summary]').textContent=(p.blockers||[]).length?`${p.blockers.length} blocage(s)`:'Aucune anomalie détectée dans la prévisualisation.';
        const confirm=mount.querySelector('[data-v16-apply-confirm]');if(confirm)confirm.disabled=Boolean((p.blockers||[]).length);
      }catch(error){alertUser(error?.message||String(error),'danger');}
    });
    mount.querySelector('[data-v16-apply-confirm]')?.addEventListener('click',async()=>{
      const date=mount.querySelector('[data-v16-apply-date]')?.value||'';
      if(!date)return;
      try{const r=await applyToReal(date);alertUser(`Application vers RÉEL terminée : ${r.affected_sessions??0} séance(s).`,'success');}
      catch(error){alertUser(error?.message||String(error),'danger');}
    });
  }
  function mount(options={}){
    if(typeof document==='undefined')return false;
    const roleApi=options.activeRoleApi||root.V16ActiveRole;
    const isAdmin=Boolean(options.isAdmin??roleApi?.isAdminAccount?.());
    const role=options.activeRole||roleApi?.get?.()||'teacher';
    configure({isAdmin,activeRole:role,supabaseClient:options.supabaseClient});
    let host=document.getElementById('v16-test-mode-root');
    if(!host){
      const planning=document.getElementById('v16-planning-root');
      if(!planning)return false;
      host=document.createElement('div');host.id='v16-test-mode-root';planning.insertAdjacentElement('beforebegin',host);
    }
    host.innerHTML=render({isAdmin,activeRole:role,context});
    bind(host);
    return true;
  }

  return {configure,getContext,setContext,resetTest,cloneRealToTest,render,previewApply,applyToReal,mount};
});
