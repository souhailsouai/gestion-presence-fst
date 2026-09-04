(function(root,factory){
  const api=factory(root.V16PlanningState,root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.V16TeacherPermutations=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(stateApi,host){
  'use strict';

  let ctx={supabaseClient:null,currentTeacher:null,teachers:[],planningState:{rows:[]},onApplied:null};

  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function isActiveAdmin(t){
    const activeRole=host.V16ActiveRole;
    if(activeRole?.canUseAdminControls)return activeRole.canUseAdminControls()===true;
    return Boolean(t&&t.isAdmin&&t.activeMode==='admin');
  }
  function client(){
    if(ctx.supabaseClient)return ctx.supabaseClient;
    try{return typeof supabaseClient!=='undefined'?supabaseClient:(host.supabaseClient||null);}catch(_){return host.supabaseClient||null;}
  }
  function teacher(){
    if(ctx.currentTeacher)return ctx.currentTeacher;
    try{return typeof currentTeacher!=='undefined'?currentTeacher:(host.currentTeacher||null);}catch(_){return host.currentTeacher||null;}
  }
  function teacherName(id){return ctx.teachers.find(t=>String(t.id)===String(id))?.full_name||String(id||'');}
  function teacherOptions(){return ctx.teachers.map(t=>`<option value="${esc(t.id)}">${esc(t.full_name||t.email||t.id)}</option>`).join('');}
  function dayLabel(day){return ({1:'Lundi',4:'Jeudi',5:'Vendredi'})[Number(day)]||'—';}
  function mondayFor(date){
    const m=String(date||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return '';
    const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));const iso=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()-(iso-1));
    return d.toISOString().slice(0,10);
  }
  function addDays(date,n){const d=new Date(`${date}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}

  function currentWeekSummary(effectiveDate){
    if(!effectiveDate||!stateApi)return {days:[],teachers:[]};
    const start=mondayFor(effectiveDate),end=addDays(start,6);
    const rows=(ctx.planningState?.rows||[]).filter(r=>r.isTeachingSession!==false&&r.date>=start&&r.date<=end);
    const dayMap=new Map(),teacherMap=new Map();
    for(const row of rows){
      const ids=[...new Set((row.groups||[]).map(g=>g.teacherId).filter(Boolean))];
      dayMap.set(row.date,ids.length);
      for(const id of ids){if(!teacherMap.has(id))teacherMap.set(id,new Set());teacherMap.get(id).add(row.date);}
    }
    return {
      days:[...dayMap.entries()].map(([date,count])=>({date,count})),
      teachers:[...teacherMap.entries()].map(([id,dates])=>({id,days:dates.size}))
    };
  }

  function values(){
    const val=id=>document.getElementById(id)?.value||'';
    return {
      teacherA:val('v16-swap-teacher-a'),dayA:Number(val('v16-swap-day-a')),
      teacherB:val('v16-swap-teacher-b'),dayB:Number(val('v16-swap-day-b')),
      scope:val('v16-swap-scope'),effectiveDate:val('v16-swap-effective-date'),context:'real'
    };
  }

  function validate(input){
    const blockers=[];
    if(!input.teacherA||!input.teacherB)blockers.push('Choisissez les deux enseignants.');
    if(input.teacherA===input.teacherB)blockers.push('Les enseignants doivent être différents.');
    if(![1,4,5].includes(Number(input.dayA))||![1,4,5].includes(Number(input.dayB)))blockers.push('Choisissez deux jours de TP valides.');
    if(Number(input.dayA)===Number(input.dayB))blockers.push('Les jours source et cible doivent être différents.');
    if(!['week','future'].includes(input.scope))blockers.push('Choisissez la portée de la permutation.');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveDate||''))blockers.push('Choisissez la date d’effet.');
    return blockers;
  }

  function renderSummary(){
    const box=document.getElementById('v16-swap-summary');if(!box)return;
    const input=values(),blockers=validate(input),week=currentWeekSummary(input.effectiveDate);
    const days=week.days.length?week.days.map(x=>`${esc(x.date)} : ${x.count}/4`).join(' · '):'Semaine non encore affectée';
    const teachers=week.teachers.length?week.teachers.map(x=>`${esc(teacherName(x.id))} : ${x.days}/2`).join(' · '):'Aucune affectation chargée';
    box.innerHTML=`<strong>Règle cible :</strong> 4 / jour, 2 jours / semaine par enseignant.<br><span>${days}</span><br><span>${teachers}</span>${blockers.length?`<div style="margin-top:6px;color:#b02a37">${blockers.map(esc).join('<br>')}</div>`:''}`;
    const button=document.getElementById('v16-swap-confirm');if(button)button.disabled=blockers.length>0;
  }

  async function submitSwap(input){
    if(!isActiveAdmin(teacher()))return {ok:false,code:'FORBIDDEN',message:'Accès Admin requis.'};
    const blockers=validate(input);if(blockers.length)return {ok:false,code:'INVALID_INPUT',message:blockers[0]};
    const c=client();if(!c)return {ok:false,code:'NO_CONNECTION',message:'Connexion Supabase indisponible.'};
    const {data,error}=await c.rpc('v16_swap_teachers',{
      p_teacher_a:input.teacherA,p_day_a:Number(input.dayA),p_teacher_b:input.teacherB,p_day_b:Number(input.dayB),
      p_effective_date:input.effectiveDate,p_scope:input.scope,p_context:input.context||'real'
    });
    if(error)throw error;
    return data||{ok:false,code:'EMPTY_RESPONSE',message:'Réponse serveur vide.'};
  }

  function panelHtml(){
    if(!isActiveAdmin(teacher()))return '';
    const opts=teacherOptions();
    return `<div class="card" style="margin:14px 0" data-v16-admin-permutation="true">
      <h3 style="margin-bottom:12px"><i class="fas fa-right-left"></i> Permuter les enseignants</h3>
      <div class="form-row">
        <div class="form-group"><label for="v16-swap-teacher-a">Enseignant A</label><select id="v16-swap-teacher-a" class="form-control"><option value="">Choisir…</option>${opts}</select></div>
        <div class="form-group"><label for="v16-swap-day-a">Jour A</label><select id="v16-swap-day-a" class="form-control"><option value="1">Lundi</option><option value="4">Jeudi</option><option value="5">Vendredi</option></select></div>
        <div class="form-group"><label for="v16-swap-teacher-b">Enseignant B</label><select id="v16-swap-teacher-b" class="form-control"><option value="">Choisir…</option>${opts}</select></div>
        <div class="form-group"><label for="v16-swap-day-b">Jour B</label><select id="v16-swap-day-b" class="form-control"><option value="4">Jeudi</option><option value="1">Lundi</option><option value="5">Vendredi</option></select></div>
        <div class="form-group"><label for="v16-swap-scope">Portée</label><select id="v16-swap-scope" class="form-control"><option value="week">Cette semaine</option><option value="future">Toutes les semaines futures</option></select></div>
        <div class="form-group"><label for="v16-swap-effective-date">Date d’effet</label><input id="v16-swap-effective-date" class="form-control" type="date"></div>
      </div>
      <div id="v16-swap-summary" class="auth-note" style="margin:0 0 12px"></div>
      <button type="button" class="btn btn-warning" id="v16-swap-confirm" disabled><i class="fas fa-right-left"></i> Permuter</button>
      <div id="v16-swap-status" aria-live="polite" style="margin-top:10px"></div>
    </div>`;
  }

  function render(state={}){
    ctx={...ctx,...state};
    const anchor=document.getElementById('v16-admin-permutations');if(!anchor)return '';
    if(!isActiveAdmin(teacher())){anchor.innerHTML='';anchor.hidden=true;return '';}
    anchor.hidden=false;anchor.innerHTML=panelHtml();
    for(const control of anchor.querySelectorAll('select,input'))control.addEventListener('change',renderSummary);
    document.getElementById('v16-swap-confirm')?.addEventListener('click',async()=>{
      const input=values();
      const label=`Permuter ${teacherName(input.teacherA)} (${dayLabel(input.dayA)}) avec ${teacherName(input.teacherB)} (${dayLabel(input.dayB)}) ?`;
      if(typeof confirm==='function'&&!confirm(label))return;
      const status=document.getElementById('v16-swap-status');if(status)status.innerHTML='<span class="badge badge-info">Vérification et permutation…</span>';
      try{
        const result=await submitSwap(input);
        if(!result?.ok)throw new Error(result?.message||result?.code||'Permutation refusée.');
        if(status)status.innerHTML=`<span class="badge badge-present">Permutation appliquée (${Number(result.changed_assignments||0)} affectation(s)).</span>`;
        if(typeof ctx.onApplied==='function')await ctx.onApplied(result);
        const week=mondayFor(input.effectiveDate);
        const c=client();if(c&&week)await c.rpc('v16_verify_teacher_week',{p_week_start:week,p_context:input.context||'real'});
      }catch(error){if(status)status.innerHTML=`<div class="alert alert-danger">${esc(error?.message||error)}</div>`;}
    });
    renderSummary();
    return anchor.innerHTML;
  }

  return {render,submitSwap,renderSummary};
});
