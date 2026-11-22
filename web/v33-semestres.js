/* V33 — Sélecteur S1/S2 et écran « Semestres ».
   S1 : synthèse en lecture (les séances du S1 restent gérées par les écrans existants).
   S2 : groupes, enseignants, manipulations, dates exclues, génération du planning,
   modifications avec verrouillage, versions, vues et PDF. Données S2 dans les tables v33_s2_*. */
(function(root){
  'use strict';
  const C=()=>root.V33S2Core;
  const client=()=>typeof supabaseClient!=='undefined'?supabaseClient:root.supabaseClient;
  const teacher=()=>typeof currentTeacher!=='undefined'?currentTeacher:root.currentTeacher;
  const isAdmin=()=>{const t=teacher();return !!(t&&t.isAdmin&&t.activeMode==='admin');};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v??'').trim().replace(/\s+/g,' ');
  const KEY='fst_semester';
  const S1_FROM='2026-09-01',S1_TO='2026-12-31';
  const CLASSES=['MPI1-A','MPI1-B','MPI1-C','MPI1-D','MPI1-E','PC1-A'];
  const KIND={ferie:'Jour férié',vacances:'Vacances',ds:'Semaine des DS',examen:'Examens',autre:'Autre'};
  const state={sem:'S1',view:'planning',planView:'classe',planClass:'MPI1-A',planTeacher:'',data:null,loading:false,msg:''};

  function semester(){return state.sem;}
  function setSemester(s){
    state.sem=s==='S2'?'S2':'S1';
    try{root.localStorage.setItem(KEY,state.sem);}catch(_){}
    document.querySelectorAll('#v33-sem-switch button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.sem===state.sem)));
    document.body.dataset.semester=state.sem;
    root.dispatchEvent(new CustomEvent('v33:semester',{detail:{semester:state.sem}}));
    if(isActive())render();
  }
  root.V33Semester={get:semester,set:setSemester,range(s){return (s||state.sem)==='S2'?{from:C().S2_MIN_DATE,to:'2027-07-31'}:{from:S1_FROM,to:S1_TO};}};

  function mountSwitch(){
    if(document.getElementById('v33-sem-switch'))return;
    const host=document.querySelector('#fst-topbar .fst-heading')||document.getElementById('fst-topbar');
    if(!host)return;
    const box=document.createElement('div');box.id='v33-sem-switch';box.setAttribute('role','group');box.setAttribute('aria-label','Semestre');
    box.innerHTML='<button type="button" data-sem="S1">S1</button><button type="button" data-sem="S2">S2</button>';
    box.addEventListener('click',e=>{const b=e.target.closest('button[data-sem]');if(b)setSemester(b.dataset.sem);});
    host.appendChild(box);
  }
  function mountTab(){
    if(document.getElementById('semestres'))return;
    const main=document.getElementById('fst-main')||document.querySelector('.content');if(!main)return;
    const tab=document.createElement('div');tab.id='semestres';tab.className='tab-content';
    tab.innerHTML='<h2><i class="fas fa-layer-group"></i> Semestres</h2><div id="v33-root"></div>';
    main.appendChild(tab);
    new MutationObserver(()=>{if(isActive())render();}).observe(tab,{attributes:true,attributeFilter:['class']});
  }
  const isActive=()=>document.getElementById('semestres')?.classList.contains('active');

  /* ---------- Données ---------- */
  async function q(p){const {data,error}=await p;if(error)throw error;return data||[];}
  async function load(force){
    if(state.data&&!force)return state.data;
    const c=client();if(!c)throw new Error('Connexion indisponible');
    const [settings,manips,slots,stations,members,excluded,sessions,sslots,versions,profiles,students,audit]=await Promise.all([
      q(c.from('v33_s2_settings').select('*')),q(c.from('v33_s2_manipulations').select('*').order('code')),
      q(c.from('v33_s2_class_slots').select('*').order('weekday').order('pair_order')),q(c.from('v33_s2_stations').select('*')),
      q(c.from('v33_s2_group_members').select('*')),q(c.from('v33_s2_excluded_dates').select('*').order('starts_on')),
      q(c.from('v33_s2_sessions').select('*').order('session_date')),q(c.from('v33_s2_slots').select('*')),
      q(c.from('v33_s2_versions').select('id,label,created_at').order('created_at',{ascending:false})),
      q(c.from('profiles').select('id,full_name,role')),
      q(c.from('students').select('id,last_name,first_name,class_id,deleted_at,classes(name)').is('deleted_at',null)),
      q(c.from('v33_s2_audit').select('*').order('created_at',{ascending:false}).limit(30)),
    ]);
    const bySession=new Map();for(const g of sslots){if(!bySession.has(g.session_id))bySession.set(g.session_id,[]);bySession.get(g.session_id).push(g);}
    for(const s of sessions){s.start_time=String(s.start_time).slice(0,5);s.end_time=String(s.end_time).slice(0,5);s.slots=(bySession.get(s.id)||[]).sort((a,b)=>a.group_no-b.group_no);}
    const st=(settings[0]||{start_date:'2027-01-11',group_count:6,manip_count:6});
    const names=new Map(profiles.map(p=>[p.id,p.full_name||'—']));
    const studentRows=students.map(s=>{const cls=s.classes?.name||'';const m=/^(.*)-G(\d+)$/.exec(cls);return {id:s.id,name:norm((s.last_name||'')+' '+(s.first_name||'')),class_id:s.class_id,s1_group:cls,class_name:m?m[1]:cls,group_no:m?Number(m[2]):null};}).filter(s=>CLASSES.includes(s.class_name));
    state.data={settings:st,manips,slots,stations,members,excluded,sessions,versions,profiles,names,students:studentRows,audit};
    return state.data;
  }
  const tname=id=>id?(state.data?.names.get(id)||'—'):'—';
  async function act(label,fn){
    try{state.msg='';await fn();state.msg='✓ '+label;await load(true);}catch(e){state.msg='⚠ '+(e.message||e);console.error(e);}
    render();
  }
  async function audit(action,detail){try{await client().from('v33_s2_audit').insert({action,detail});}catch(_){}}

  /* ---------- Rendu ---------- */
  async function render(){
    const out=document.getElementById('v33-root');if(!out)return;
    if(state.sem==='S1'){renderS1(out);return;}
    out.innerHTML='<p class="v33-muted">Chargement du semestre 2…</p>';
    let d;try{d=await load(false);}catch(e){out.innerHTML=`<p class="v33-warn">Impossible de charger le S2 : ${esc(e.message)}</p>`;return;}
    const admin=isAdmin();
    const tabs=[['planning','Planning'],['groupes','Groupes'],['enseignants','Enseignants'],['manips','Manipulations'],['dates','Dates exclues'],['parametres','Paramètres'],['versions','Versions']];
    const visible=admin?tabs:tabs.filter(t=>['planning','groupes','enseignants','manips','dates'].includes(t[0]));
    if(!visible.some(t=>t[0]===state.view))state.view='planning';
    out.innerHTML=`<div class="v33-banner"><strong>Semestre 2</strong> · à partir du ${C().fmt(d.settings.start_date)}${d.settings.end_date?' jusqu\'au '+C().fmt(d.settings.end_date):''} · ${d.sessions.length} séance(s) planifiée(s)${admin?'':' · lecture seule'}</div>
      <nav class="v33-chips" role="tablist">${visible.map(([k,l])=>`<button type="button" role="tab" data-view="${k}" aria-selected="${k===state.view}">${l}</button>`).join('')}</nav>
      ${state.msg?`<p class="v33-msg">${esc(state.msg)}</p>`:''}<div id="v33-view"></div>`;
    out.querySelector('.v33-chips').addEventListener('click',e=>{const b=e.target.closest('[data-view]');if(b){state.view=b.dataset.view;state.msg='';render();}});
    const v=out.querySelector('#v33-view');
    ({planning:viewPlanning,groupes:viewGroups,enseignants:viewTeachers,manips:viewManips,dates:viewDates,parametres:viewSettings,versions:viewVersions})[state.view](v,d,admin);
  }

  async function renderS1(out){
    out.innerHTML=`<div class="v33-banner"><strong>Semestre 1</strong> · données du S1 (présences, séances, planning des séances). Les séances du 23/11 au 11/12/2026 sont protégées contre tout import ou recalcul automatique.</div><div id="v33-s1">Chargement…</div>`;
    try{
      const c=client();
      const rows=await q(c.from('sessions').select('id,session_date,classes(name),attendance(status)').gte('session_date',S1_FROM).lte('session_date',S1_TO).is('deleted_at',null));
      const by=new Map();
      for(const s of rows){const cls=(s.classes?.name||'').replace(/-G\d+$/,'');if(!CLASSES.includes(cls))continue;if(!by.has(cls))by.set(cls,{dates:new Set(),p:0,a:0,t:0});const b=by.get(cls);b.dates.add(s.session_date);for(const a of s.attendance||[]){b.t++;if(a.status==='absent')b.a++;else b.p++;}}
      document.getElementById('v33-s1').innerHTML=`<table class="v33-table"><thead><tr><th>Classe</th><th>Dates de TP</th><th>Présences saisies</th><th>Taux de présence</th></tr></thead><tbody>${CLASSES.map(cls=>{const b=by.get(cls)||{dates:new Set(),p:0,a:0,t:0};return `<tr><td>${cls}</td><td>${b.dates.size}</td><td>${b.t}</td><td>${b.t?Math.round(100*b.p/b.t)+' %':'—'}</td></tr>`;}).join('')}</tbody></table>
        <p class="v33-muted">Pour le détail, utilisez « Statistiques », « Séances » et « Planning des séances ». Passez sur <strong>S2</strong> en haut de page pour préparer le second semestre.</p>`;
    }catch(e){document.getElementById('v33-s1').textContent='Impossible de charger le S1 : '+e.message;}
  }

  /* ----- Planning ----- */
  function planIssues(d){return C().checkPlan({settings:d.settings,excluded:d.excluded,sessions:d.sessions});}
  function viewPlanning(v,d,admin){
    const issues=d.sessions.length?planIssues(d):[];
    const errors=issues.filter(i=>i.level==='erreur'),warns=issues.filter(i=>i.level==='attention'),infos=issues.filter(i=>i.level==='info');
    const teachers=[...new Set(d.sessions.flatMap(s=>s.slots.map(g=>g.teacher_id)).filter(Boolean))].sort((a,b)=>tname(a).localeCompare(tname(b)));
    if(!state.planTeacher&&teachers.length)state.planTeacher=teachers[0];
    v.innerHTML=`${admin?`<div class="v33-toolbar">
        <button type="button" class="btn btn-primary" data-act="gen"><i class="fas fa-wand-magic-sparkles"></i> Générer le planning</button>
        <span class="v33-inline">Recalculer à partir du <input type="date" id="v33-from" min="${d.settings.start_date}" value="${d.settings.start_date}"> <button type="button" class="btn" data-act="regen">Recalculer</button></span>
        <button type="button" class="btn" data-act="version"><i class="fas fa-bookmark"></i> Enregistrer une version</button>
      </div>`:''}
      <div class="v33-toolbar"><label>Vue <select id="v33-pv"><option value="classe">Par classe</option><option value="enseignant">Par enseignant</option><option value="semaine">Par semaine</option></select></label>
        <span id="v33-pv-extra"></span>
        <button type="button" class="btn" data-act="pdf"><i class="fas fa-file-pdf"></i> PDF</button><button type="button" class="btn" data-act="pdfall">PDF toutes les classes</button></div>
      ${d.sessions.length?`<div class="v33-checks">${errors.length?`<p class="v33-warn">${errors.length} erreur(s) :</p><ul>${errors.map(i=>`<li>${esc(i.text)}</li>`).join('')}</ul>`:'<p class="v33-ok">Aucune erreur : chaque date respecte le début du S2 et les dates exclues validées, sans enseignant en double.</p>'}
        ${warns.length?`<details><summary>${warns.length} point(s) à vérifier</summary><ul>${warns.map(i=>`<li>${esc(i.text)}</li>`).join('')}</ul></details>`:''}
        ${infos.length?`<details><summary>${infos.length} remarque(s)</summary><ul>${infos.map(i=>`<li>${esc(i.text)}</li>`).join('')}</ul></details>`:''}</div>`:`<p class="v33-muted">Aucune séance S2 pour l'instant.${admin?' Vérifiez les enseignants, les manipulations et les dates exclues, puis cliquez sur « Générer le planning ».':''}</p>`}
      <div id="v33-plan"></div>`;
    const sel=v.querySelector('#v33-pv');sel.value=state.planView;
    const extra=v.querySelector('#v33-pv-extra');
    if(state.planView==='classe')extra.innerHTML=`<select id="v33-pc">${CLASSES.map(c=>`<option ${c===state.planClass?'selected':''}>${c}</option>`).join('')}</select>`;
    if(state.planView==='enseignant')extra.innerHTML=`<select id="v33-pt">${teachers.map(t=>`<option value="${t}" ${t===state.planTeacher?'selected':''}>${esc(tname(t))}</option>`).join('')}</select>`;
    sel.addEventListener('change',()=>{state.planView=sel.value;render();});
    extra.addEventListener('change',e=>{if(e.target.id==='v33-pc')state.planClass=e.target.value;if(e.target.id==='v33-pt')state.planTeacher=e.target.value;render();});
    v.addEventListener('click',e=>{if(e.target.closest('.v33-toolbar'))toolbar(e,d);});
    const plan=v.querySelector('#v33-plan');
    if(state.planView==='classe')planByClass(plan,d,admin);
    else if(state.planView==='enseignant')planByTeacher(plan,d);
    else planByWeek(plan,d);
  }

  async function toolbar(e,d){
    const b=e.target.closest('[data-act]');if(!b)return;e.stopPropagation();
    const a=b.dataset.act;
    if(a==='pdf')return exportPdf(state.planView==='classe'?[state.planClass]:CLASSES,d);
    if(a==='pdfall')return exportPdf(CLASSES,d);
    if(a==='version'){const label=prompt('Nom de la version (ex. « Avant modification du 15/02 ») :');if(label)await act('Version enregistrée',()=>q(client().rpc('v33_s2_save_version',{p_label:label.slice(0,120)})));return;}
    if(a==='gen'||a==='regen'){
      const from=a==='gen'?d.settings.start_date:(document.getElementById('v33-from').value||d.settings.start_date);
      const kept=d.sessions.filter(s=>s.locked||s.session_date<from);
      const missing=d.stations.filter(s=>s.teacher_id).length;
      const {sessions,warnings}=C().generatePlan({settings:d.settings,classSlots:d.slots,stations:d.stations,manipulations:d.manips,excluded:d.excluded,kept,fromDate:from});
      const replaced=d.sessions.filter(s=>!s.locked&&s.session_date>=from).length;
      const msg=`${sessions.length} séance(s) seront créées à partir du ${C().fmt(from)}.\n${replaced?replaced+' séance(s) non verrouillée(s) seront remplacées.\n':''}${kept.length?kept.length+' séance(s) conservée(s) (verrouillées ou antérieures).\n':''}${missing?'':'Attention : aucun enseignant n\'est encore affecté aux postes.\n'}${warnings.length?'\n'+warnings.join('\n'):''}\n\nUne version de sauvegarde est enregistrée avant. Continuer ?`;
      if(!confirm(msg))return;
      await act('Planning enregistré',async()=>{
        if(d.sessions.length)await q(client().rpc('v33_s2_save_version',{p_label:'Sauvegarde automatique avant recalcul du '+C().fmt(from)}));
        await q(client().rpc('v33_s2_replace_plan',{p_from:from,p_sessions:sessions,p_reason:a==='gen'?'génération':'recalcul ciblé'}));
      });
    }
  }

  function cell(g){return g?`<span class="v33-cellmain"><span class="v33-m">${esc(g.manipulation_code)}</span>${g.room?` · Salle ${esc(g.room)}`:''}</span><small>${esc(tname(g.teacher_id))}</small>`:'—';}
  function planByClass(box,d,admin){
    const cls=state.planClass;const list=d.sessions.filter(s=>s.class_name===cls);
    const slot=d.slots.find(s=>s.class_name===cls);
    const groups=Array.from({length:d.settings.group_count},(_,i)=>i+1);
    if(!list.length){box.innerHTML=`<p class="v33-muted">Aucune séance pour ${cls}.</p>`;return;}
    const ex=C().excludedMap(d.excluded);
    const first=list[0].session_date,last=list[list.length-1].session_date;
    const rows=[];
    if(slot){for(let x=first;x<=last;x=C().addDays(x,7)){if(ex.has(x)&&!list.some(s=>s.session_date===x))rows.push({ex:ex.get(x),date:x});}}
    for(const s of list)rows.push({s,date:s.session_date});
    rows.sort((a,b)=>a.date.localeCompare(b.date));
    box.innerHTML=`<div class="v33-scroll"><table class="v33-table v33-plan"><thead><tr><th>${slot?C().DAY_LABEL[slot.weekday]:''}<br><small>${slot?slot.start_time.slice(0,5)+' – '+slot.end_time.slice(0,5):''}</small></th>${groups.map(g=>`<th>G${g}</th>`).join('')}${admin?'<th></th>':''}</tr></thead><tbody>
      ${rows.map(r=>r.ex?`<tr class="v33-exrow"><td>${C().fmt(r.date)}</td><td colspan="${groups.length+(admin?1:0)}">${esc(r.ex)} — aucun TP</td></tr>`:
        `<tr data-sid="${r.s.id}"><td>${C().fmt(r.date)}<br><small>passage ${r.s.occurrence}</small></td>${groups.map(g=>{const x=r.s.slots.find(y=>y.group_no===g);return `<td class="${x&&x.locked?'v33-locked':''}" ${admin&&x?`data-slot="${x.id}" tabindex="0" role="button" aria-label="Modifier G${g}"`:''}>${cell(x)}</td>`;}).join('')}
        ${admin?`<td class="v33-rowact"><button type="button" class="btn btn-sm" data-lock="${r.s.id}" title="${r.s.locked?'Déverrouiller':'Verrouiller'}">${r.s.locked?'🔒':'🔓'}</button> <button type="button" class="btn btn-sm" data-move="${r.s.id}" title="Changer la date">📅</button></td>`:''}</tr>`).join('')}
    </tbody></table></div><p class="v33-muted">${admin?'Cliquez une case pour changer la manipulation, l\'enseignant ou la salle (la case est alors verrouillée). 🔒 : séance gardée telle quelle par les recalculs.':''}</p>`;
    if(!admin)return;
    box.addEventListener('click',async e=>{
      const lk=e.target.closest('[data-lock]'),mv=e.target.closest('[data-move]'),sl=e.target.closest('[data-slot]');
      if(lk){const s=d.sessions.find(x=>x.id===lk.dataset.lock);await act(s.locked?'Séance déverrouillée':'Séance verrouillée',async()=>{await q(client().from('v33_s2_sessions').update({locked:!s.locked}).eq('id',s.id).select('id'));await audit(s.locked?'unlock':'lock',{session:s.id,class:s.class_name,date:s.session_date});});}
      else if(mv){const s=d.sessions.find(x=>x.id===mv.dataset.move);const nd=prompt(`Nouvelle date pour ${s.class_name} (AAAA-MM-JJ) :`,s.session_date);if(!nd||nd===s.session_date)return;
        if(nd<d.settings.start_date){alert('Impossible : le S2 commence le '+C().fmt(d.settings.start_date)+'.');return;}
        if(C().excludedMap(d.excluded).has(nd)&&!confirm('Cette date est exclue. Continuer quand même ?'))return;
        await act('Séance déplacée et verrouillée',async()=>{await q(client().from('v33_s2_sessions').update({session_date:nd,locked:true}).eq('id',s.id).select('id'));await audit('move',{session:s.id,from:s.session_date,to:nd});});}
      else if(sl)editSlot(sl.dataset.slot,d);
    });
  }
  function editSlot(id,d){
    const s=d.sessions.find(x=>x.slots.some(y=>y.id===id));const g=s.slots.find(y=>y.id===id);
    const dlg=document.createElement('div');dlg.className='v33-modal';dlg.setAttribute('role','dialog');dlg.setAttribute('aria-modal','true');
    dlg.innerHTML=`<div class="v33-modal-box"><h3>${esc(s.class_name)} · ${C().fmt(s.session_date)} · G${g.group_no}</h3>
      <label>Manipulation <select id="v33-e-m">${d.manips.map(m=>`<option value="${m.code}" ${m.code===g.manipulation_code?'selected':''}>${m.code}${m.title?' — '+esc(m.title):''}</option>`).join('')}</select></label>
      <label>Enseignant <select id="v33-e-t"><option value="">—</option>${d.profiles.map(p=>`<option value="${p.id}" ${p.id===g.teacher_id?'selected':''}>${esc(p.full_name)}</option>`).join('')}</select></label>
      <label>Salle <input id="v33-e-r" value="${esc(g.room||'')}" maxlength="40"></label>
      <div class="v33-actions"><button type="button" class="btn" data-x>Annuler</button><button type="button" class="btn btn-primary" data-ok>Enregistrer</button></div></div>`;
    document.body.appendChild(dlg);dlg.querySelector('select').focus();
    const close=()=>dlg.remove();
    dlg.addEventListener('click',async e=>{if(e.target===dlg||e.target.closest('[data-x]'))return close();
      if(e.target.closest('[data-ok]')){const patch={manipulation_code:dlg.querySelector('#v33-e-m').value,teacher_id:dlg.querySelector('#v33-e-t').value||null,room:dlg.querySelector('#v33-e-r').value.trim()||null,locked:true};close();
        await act('Case modifiée et verrouillée',async()=>{await q(client().from('v33_s2_slots').update(patch).eq('id',id).select('id'));await q(client().from('v33_s2_sessions').update({locked:true}).eq('id',s.id).select('id'));await audit('edit_slot',{slot:id,before:{m:g.manipulation_code,t:g.teacher_id,r:g.room},after:patch});});}});
    dlg.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  }
  function planByTeacher(box,d){
    const t=state.planTeacher;
    const rows=d.sessions.flatMap(s=>s.slots.filter(g=>g.teacher_id===t).map(g=>({s,g})));
    box.innerHTML=rows.length?`<table class="v33-table"><thead><tr><th>Date</th><th>Horaire</th><th>Classe</th><th>Groupe</th><th>Manipulation</th><th>Salle</th></tr></thead><tbody>${rows.map(({s,g})=>`<tr><td>${C().DAY_LABEL[C().weekdayOf(s.session_date)]} ${C().fmt(s.session_date)}</td><td>${s.start_time}–${s.end_time}</td><td>${s.class_name}</td><td>G${g.group_no}</td><td>${g.manipulation_code}</td><td>${esc(g.room||'')}</td></tr>`).join('')}</tbody></table><p class="v33-muted">${rows.length} créneau(x).</p>`:'<p class="v33-muted">Aucun créneau pour cet enseignant.</p>';
  }
  function planByWeek(box,d){
    const weeks=new Map();
    for(const s of d.sessions){const w=C().addDays(s.session_date,1-C().weekdayOf(s.session_date));if(!weeks.has(w))weeks.set(w,[]);weeks.get(w).push(s);}
    box.innerHTML=[...weeks].map(([w,list])=>`<section class="v33-week"><h4>Semaine du ${C().fmt(w)}</h4><ul>${list.map(s=>`<li>${C().DAY_LABEL[C().weekdayOf(s.session_date)]} ${C().fmt(s.session_date)} · ${s.start_time}–${s.end_time} · <strong>${s.class_name}</strong> (passage ${s.occurrence})${s.locked?' 🔒':''}</li>`).join('')}</ul></section>`).join('')||'<p class="v33-muted">Aucune séance.</p>';
  }

  /* ----- PDF (modèle du S1 : une page par classe) ----- */
  async function exportPdf(classes,d){
    const jsPDF=root.jspdf?.jsPDF;if(!jsPDF){alert('Le moteur PDF n\'est pas chargé.');return;}
    const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
    const ex=C().excludedMap(d.excluded);let first=true;
    for(const cls of classes){
      const list=d.sessions.filter(s=>s.class_name===cls);if(!list.length)continue;
      if(!first)doc.addPage();first=false;
      const slot=d.slots.find(s=>s.class_name===cls);const G=d.settings.group_count;
      const rows=[];const a=list[0].session_date,b=list[list.length-1].session_date;
      for(let x=a;x<=b;x=C().addDays(x,7))if(ex.has(x)&&!list.some(s=>s.session_date===x))rows.push({date:x,ex:ex.get(x)});
      for(const s of list)rows.push({date:s.session_date,s});rows.sort((p,q2)=>p.date.localeCompare(q2.date));
      const X=14,W=269,c0=36,cw=(W-c0)/G;let y=10;
      const box=(x,yy,w,h,fill)=>{if(fill){doc.setFillColor(...fill);doc.rect(x,yy,w,h,'FD');}else doc.rect(x,yy,w,h);};
      doc.setDrawColor(40);doc.setLineWidth(0.2);
      box(X,y,W,8,[243,241,234]);doc.setFont('times','bold');doc.setFontSize(10);doc.setTextColor(20);doc.text(`[${cls.split('-')[0]}] - [${d.settings.academic_year}] - [SEMESTRE 2]`,X+W/2,y+5.5,{align:'center'});y+=8;
      box(X,y,W,12,[243,241,234]);doc.setFontSize(16);doc.text('PLANNING DES TP DE PHYSIQUE',X+W/2,y+8.3,{align:'center'});y+=12;
      box(X,y,W,9,[255,242,0]);doc.setFontSize(12);doc.text(cls,X+W/2,y+6.3,{align:'center'});y+=9;
      const hh=9;box(X,y,c0,hh);doc.setTextColor(190,0,0);doc.setFontSize(9);doc.text(slot?C().DAY_LABEL[slot.weekday]:'',X+c0/2,y+6,{align:'center'});doc.setTextColor(20);
      for(let g=0;g<G;g++){box(X+c0+g*cw,y,cw,hh,[221,235,247]);doc.text('G'+(g+1),X+c0+g*cw+cw/2,y+6,{align:'center'});}y+=hh;
      box(X,y,c0,8);doc.setFontSize(8.5);doc.text(slot?`${slot.start_time.slice(0,5).replace(':','H')} - ${slot.end_time.slice(0,5).replace(':','H')}`:'',X+c0/2,y+5.5,{align:'center'});for(let g=0;g<G;g++)box(X+c0+g*cw,y,cw,8);y+=8;
      const rh=Math.min(17,(195-y-10)/Math.max(rows.length,1));
      for(const r of rows){
        if(r.ex){box(X,y,c0,rh,[252,229,180]);box(X+c0,y,W-c0,rh,[252,229,180]);doc.setTextColor(20);doc.text(C().fmt(r.date),X+c0/2,y+rh/2+1.5,{align:'center'});doc.setTextColor(190,0,0);doc.text(`${r.ex} - aucun TP`,X+c0+(W-c0)/2,y+rh/2+1.5,{align:'center'});doc.setTextColor(20);}
        else{box(X,y,c0,rh);doc.text(C().fmt(r.date),X+c0/2,y+rh/2+1.5,{align:'center'});doc.setTextColor(31,73,125);
          for(let g=0;g<G;g++){const x=r.s.slots.find(z=>z.group_no===g+1);box(X+c0+g*cw,y,cw,rh);if(x){doc.text(`${x.manipulation_code}${x.room?' - Salle '+x.room:''}`,X+c0+g*cw+cw/2,y+rh/2,{align:'center'});doc.setFontSize(6.5);doc.setFont('times','normal');doc.text(tname(x.teacher_id),X+c0+g*cw+cw/2,y+rh/2+4,{align:'center'});doc.setFontSize(8.5);doc.setFont('times','bold');}}
          doc.setTextColor(20);}
        y+=rh;
      }
      const last=list[list.length-1].session_date;
      box(X,y,W,8,[230,230,230]);doc.setFont('times','italic');doc.setFontSize(8);doc.text(`Planning ${cls} arrêté au ${C().fmt(C().addDays(last,1))} - dernière séance : ${C().DAY_LABEL[C().weekdayOf(last)].toLowerCase()} ${C().fmt(last)}`,X+W/2,y+5.3,{align:'center'});doc.setFont('times','bold');
    }
    if(first){alert('Aucune séance à exporter.');return;}
    doc.save(classes.length===1?`Planning_${classes[0]}_TP_Physique_S2.pdf`:'Planning_TP_Physique_S2.pdf');
  }

  /* ----- Groupes ----- */
  function viewGroups(v,d,admin){
    if(!d.members.length){
      v.innerHTML=`<p>Les groupes S2 ne sont pas encore créés.</p>${admin?`<p class="v33-muted">« Préparer les groupes » reprend les groupes du S1 et propose d'exclure les étudiants absents à toutes les séances du S1 (les « toujours absents » marqués en rouge). Chaque exclusion se réintègre en un clic.</p><button type="button" class="btn btn-primary" id="v33-init">Préparer les groupes S2</button>`:''}`;
      v.querySelector('#v33-init')?.addEventListener('click',()=>initGroups(d));return;
    }
    const G=d.settings.group_count;
    const sname=new Map(d.students.map(s=>[s.id,s]));
    v.innerHTML=`${admin?`<div class="v33-toolbar"><button type="button" class="btn btn-primary" id="v33-bal">Équilibrer les groupes</button><button type="button" class="btn" id="v33-sync">Ajouter les nouveaux étudiants</button>${applyButton(d)}</div>`:''}
      ${CLASSES.map(cls=>{const ms=d.members.filter(m=>m.class_name===cls);const act=ms.filter(m=>m.status==='actif');const exc=ms.filter(m=>m.status==='exclu');
        return `<section class="v33-card"><h3>${cls} <small>${act.length} actif(s)${exc.length?' · '+exc.length+' exclu(s)':''}</small></h3><div class="v33-groups">${Array.from({length:G},(_,i)=>i+1).map(g=>{const list=act.filter(m=>m.group_no===g).sort((a,b)=>(sname.get(a.student_id)?.name||'').localeCompare(sname.get(b.student_id)?.name||''));
          return `<div class="v33-group"><h4>G${g} <small>(${list.length})</small></h4><ul>${list.map(m=>`<li><span class="v33-sn">${esc(sname.get(m.student_id)?.name||'?')}${m.locked?' 🔒':''}</span>${admin?`<span class="v33-sc"><select data-mv="${m.student_id}" aria-label="Groupe">${Array.from({length:G},(_,j)=>`<option ${j+1===g?'selected':''}>${j+1}</option>`).join('')}</select> <button type="button" class="btn btn-sm" data-lk="${m.student_id}" title="${m.locked?'Déverrouiller':'Verrouiller dans ce groupe'}">${m.locked?'🔓':'🔒'}</button> <button type="button" class="btn btn-sm" data-ex="${m.student_id}" title="Exclure du S2">✕</button></span>`:''}</li>`).join('')}</ul></div>`;}).join('')}</div>
        ${exc.length?`<details><summary>Exclus (${exc.length})</summary><ul>${exc.map(m=>`<li>${esc(sname.get(m.student_id)?.name||'?')} — <em>${esc(m.reason||'')}</em>${admin?` <button type="button" class="btn btn-sm" data-in="${m.student_id}">Réintégrer</button>`:''}</li>`).join('')}</ul></details>`:''}</section>`;}).join('')}`;
    if(!admin)return;
    const upd=(id,patch,label,ev)=>act(label,async()=>{await q(client().from('v33_s2_group_members').update(Object.assign({updated_at:new Date().toISOString()},patch)).eq('student_id',id).select('student_id'));await audit(ev,Object.assign({student:id},patch));});
    v.addEventListener('change',e=>{const s=e.target.closest('[data-mv]');if(s)upd(s.dataset.mv,{group_no:Number(s.value),locked:true},'Étudiant déplacé (verrouillé dans son nouveau groupe)','move_student');});
    v.addEventListener('click',e=>{
      const lk=e.target.closest('[data-lk]'),ex=e.target.closest('[data-ex]'),inn=e.target.closest('[data-in]');
      if(lk){const m=d.members.find(x=>x.student_id===lk.dataset.lk);upd(m.student_id,{locked:!m.locked},m.locked?'Déverrouillé':'Verrouillé','lock_student');}
      if(ex){const r=prompt('Motif de l\'exclusion du S2 :','Toujours absent au S1');if(r!==null)upd(ex.dataset.ex,{status:'exclu',reason:r.slice(0,200)},'Étudiant exclu du S2','exclude_student');}
      if(inn)upd(inn.dataset.in,{status:'actif',reason:null},'Étudiant réintégré','reintegrate_student');
    });
    v.querySelector('#v33-bal').addEventListener('click',()=>{
      const members=d.members.map(m=>Object.assign({},m,{name:sname.get(m.student_id)?.name||''}));
      const {moves}=C().balanceGroups(members,G);
      if(!moves.length){alert('Les groupes sont déjà équilibrés (écart d\'au plus un étudiant).');return;}
      if(!confirm(`${moves.length} déplacement(s) proposé(s) :\n\n${moves.map(m=>`${m.name} : ${m.class_name} G${m.from} → G${m.to}`).join('\n')}\n\nLes étudiants verrouillés ne bougent pas. Appliquer ?`))return;
      act('Groupes équilibrés',async()=>{for(const m of moves)await q(client().from('v33_s2_group_members').update({group_no:m.to,updated_at:new Date().toISOString()}).eq('student_id',m.student_id).select('student_id'));await audit('balance',{moves});});
    });
    v.querySelector('#v33-sync').addEventListener('click',()=>{const known=new Set(d.members.map(m=>m.student_id));const add=d.students.filter(s=>!known.has(s.id)&&s.group_no);
      if(!add.length){alert('Aucun nouvel étudiant.');return;}
      act(add.length+' étudiant(s) ajouté(s)',async()=>{await q(client().from('v33_s2_group_members').insert(add.map(s=>({student_id:s.id,class_name:s.class_name,group_no:s.group_no,s1_class_id:s.class_id}))).select('student_id'));await audit('add_students',{n:add.length});});});
    v.querySelector('#v33-apply')?.addEventListener('click',()=>applyGroups(d));
  }
  function applyButton(d){
    const today=new Date().toISOString().slice(0,10);
    return today>'2026-12-11'?'<button type="button" class="btn" id="v33-apply">Appliquer les groupes S2 aux listes de présence</button>':'<span class="v33-muted">Application aux listes de présence possible après le 11/12/2026 (séances S1 protégées).</span>';
  }
  async function initGroups(d){
    const c=client();
    await act('Groupes S2 préparés',async()=>{
      const att=await q(c.from('attendance').select('student_id,status,sessions!inner(session_date)').gte('sessions.session_date',S1_FROM).lte('sessions.session_date',S1_TO));
      const seen=new Map();for(const a of att){const s=seen.get(a.student_id)||{n:0,p:0};s.n++;if(a.status!=='absent')s.p++;seen.set(a.student_id,s);}
      const rows=d.students.filter(s=>s.group_no).map(s=>{const k=seen.get(s.id);const always=k&&k.n>=1&&k.p===0;
        return {student_id:s.id,class_name:s.class_name,group_no:s.group_no,s1_class_id:s.class_id,status:always?'exclu':'actif',reason:always?`Toujours absent au S1 (${k.n} séance${k.n>1?'s':''}) — réintégrable`:null};});
      await q(c.from('v33_s2_group_members').insert(rows).select('student_id'));
      await audit('init_groups',{n:rows.length,excluded:rows.filter(r=>r.status==='exclu').length});
    });
  }
  async function applyGroups(d){
    const sname=new Map(d.students.map(s=>[s.id,s]));
    const classes=await q(client().from('classes').select('id,name'));const byName=new Map(classes.map(c=>[c.name,c.id]));
    const moves=d.members.filter(m=>m.status==='actif').map(m=>({m,s:sname.get(m.student_id),target:byName.get(`${m.class_name}-G${m.group_no}`)})).filter(x=>x.s&&x.target&&x.target!==x.s.class_id);
    if(!moves.length){alert('Les listes de présence correspondent déjà aux groupes S2.');return;}
    if(!confirm(`${moves.length} étudiant(s) changeront de groupe dans les listes de présence. Les présences du S1 restent attachées à leurs séances. Continuer ?`))return;
    await act('Groupes S2 appliqués aux listes de présence',async()=>{for(const x of moves)await q(client().from('students').update({class_id:x.target}).eq('id',x.s.id).select('id'));await audit('apply_groups',{moves:moves.map(x=>({student:x.s.id,from:x.s.class_id,to:x.target}))});});
  }

  /* ----- Enseignants (postes jour × manipulation) ----- */
  function viewTeachers(v,d,admin){
    const days=[...new Set(d.slots.filter(s=>s.active).map(s=>s.weekday))].sort();
    const get=(w,c)=>d.stations.find(s=>s.weekday===w&&s.manipulation_code===c)||{};
    const opts=sel=>`<option value="">—</option>${d.profiles.slice().sort((a,b)=>String(a.full_name).localeCompare(String(b.full_name))).map(p=>`<option value="${p.id}" ${p.id===sel?'selected':''}>${esc(p.full_name)}</option>`).join('')}`;
    v.innerHTML=`<p class="v33-muted">Les enseignants du S2 sont indépendants du S1. Un enseignant tient un poste (jour, manipulation) ; la rotation des groupes fait le reste.</p>
      ${admin?'<div class="v33-toolbar"><button type="button" class="btn" id="v33-s1t">Proposer les enseignants du S1</button></div>':''}
      <div class="v33-scroll"><table class="v33-table"><thead><tr><th>Jour</th>${d.manips.map(m=>`<th>${m.code}${m.title?'<br><small>'+esc(m.title)+'</small>':''}</th>`).join('')}</tr></thead><tbody>
      ${days.map(w=>`<tr><td>${C().DAY_LABEL[w]}<br><small>${d.slots.filter(s=>s.weekday===w).map(s=>s.class_name).join(', ')}</small></td>${d.manips.map(m=>{const s=get(w,m.code);return `<td>${admin?`<select data-w="${w}" data-c="${m.code}" aria-label="${C().DAY_LABEL[w]} ${m.code}">${opts(s.teacher_id)}</select><input data-rw="${w}" data-rc="${m.code}" value="${esc(s.room||'')}" placeholder="Salle ${esc(m.room||'')}" maxlength="40" aria-label="Salle">`:`${esc(tname(s.teacher_id))}${s.room?'<br><small>Salle '+esc(s.room)+'</small>':''}`}</td>`;}).join('')}</tr>`).join('')}
      </tbody></table></div>${admin?'<button type="button" class="btn btn-primary" id="v33-st-save">Enregistrer les enseignants</button>':''}`;
    if(!admin)return;
    v.querySelector('#v33-st-save').addEventListener('click',()=>{
      const rows=[];v.querySelectorAll('select[data-w]').forEach(s=>{const w=Number(s.dataset.w),c=s.dataset.c;const r=v.querySelector(`input[data-rw="${w}"][data-rc="${c}"]`).value.trim();rows.push({weekday:w,manipulation_code:c,teacher_id:s.value||null,room:r||null,updated_at:new Date().toISOString()});});
      act('Enseignants S2 enregistrés (le planning existant n\'est pas modifié : recalculez-le si besoin)',async()=>{await q(client().from('v33_s2_stations').upsert(rows,{onConflict:'weekday,manipulation_code'}).select('weekday'));await audit('stations',{n:rows.length});});
    });
    v.querySelector('#v33-s1t').addEventListener('click',async()=>{
      try{const rows=await q(client().from('sessions').select('session_date,teacher_id,classes(name)').gte('session_date',S1_FROM).lte('session_date','2026-11-22').is('deleted_at',null));
        const sug=C().stationsFromS1(rows.map(r=>({class_name:r.classes?.name,session_date:r.session_date,teacher_id:r.teacher_id})));
        for(const s of sug){const el=v.querySelector(`select[data-w="${s.weekday}"][data-c="${s.manipulation_code}"]`);if(el)el.value=s.teacher_id;}
        alert('Enseignants du S1 proposés. Vérifiez puis cliquez « Enregistrer les enseignants ».');}catch(e){alert(e.message);}
    });
  }

  /* ----- Manipulations ----- */
  function viewManips(v,d,admin){
    v.innerHTML=`<table class="v33-table"><thead><tr><th>Code</th><th>Nom de la manipulation</th><th>Salle par défaut</th><th>Active</th></tr></thead><tbody>
      ${d.manips.map(m=>`<tr><td>${m.code}</td><td>${admin?`<input data-t="${m.code}" value="${esc(m.title||'')}" maxlength="120" placeholder="ex. Prisme">`:esc(m.title||'—')}</td><td>${admin?`<input data-r="${m.code}" value="${esc(m.room||'')}" maxlength="40">`:esc(m.room||'')}</td><td>${admin?`<input type="checkbox" data-a="${m.code}" ${m.active?'checked':''}>`:(m.active?'Oui':'Non')}</td></tr>`).join('')}</tbody></table>
      ${admin?'<button type="button" class="btn btn-primary" id="v33-m-save">Enregistrer</button>':''}`;
    v.querySelector('#v33-m-save')?.addEventListener('click',()=>{
      const rows=d.manips.map(m=>({code:m.code,title:v.querySelector(`[data-t="${m.code}"]`).value.trim()||null,room:v.querySelector(`[data-r="${m.code}"]`).value.trim()||null,active:v.querySelector(`[data-a="${m.code}"]`).checked,updated_at:new Date().toISOString()}));
      act('Manipulations enregistrées',async()=>{await q(client().from('v33_s2_manipulations').upsert(rows,{onConflict:'code'}).select('code'));await audit('manips',{rows});});
    });
  }

  /* ----- Dates exclues ----- */
  function viewDates(v,d,admin){
    v.innerHTML=`<p class="v33-muted">Les calendriers sont indicatifs : une date importée reste une <strong>proposition</strong> tant qu'elle n'est pas validée, et seules les dates validées sont évitées par le planning.</p>
      ${admin?`<form id="v33-dform" class="v33-toolbar"><input type="date" name="a" required min="2027-01-01" aria-label="Du"> <input type="date" name="b" aria-label="Au (facultatif)"> <input name="l" placeholder="Libellé (ex. Vacances de printemps)" required maxlength="160"> <select name="k">${Object.entries(KIND).map(([k,l])=>`<option value="${k}">${l}</option>`).join('')}</select> <button class="btn btn-primary">Ajouter (validée)</button></form>
        <div class="v33-toolbar"><label class="btn">Importer un calendrier (.xlsx) <input type="file" id="v33-cal" accept=".xlsx,.xls" hidden></label></div>`:''}
      <table class="v33-table"><thead><tr><th>Du</th><th>Au</th><th>Libellé</th><th>Type</th><th>Origine</th><th>État</th>${admin?'<th></th>':''}</tr></thead><tbody>
      ${d.excluded.map(x=>`<tr class="${x.validated?'':'v33-prop'}"><td>${C().fmt(x.starts_on)}</td><td>${C().fmt(x.ends_on)}</td><td>${esc(x.label)}</td><td>${KIND[x.kind]||x.kind}</td><td>${x.source==='calendrier'?'Calendrier':'Saisie'}</td><td>${x.validated?'Validée':'Proposition'}</td>${admin?`<td><button type="button" class="btn btn-sm" data-val="${x.id}">${x.validated?'Retirer la validation':'Valider'}</button> <button type="button" class="btn btn-sm" data-del="${x.id}">Supprimer</button></td>`:''}</tr>`).join('')||`<tr><td colspan="7" class="v33-muted">Aucune date exclue.</td></tr>`}</tbody></table>`;
    if(!admin)return;
    v.querySelector('#v33-dform').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.target);const a=f.get('a'),b=f.get('b')||a;if(b<a){alert('La date de fin précède le début.');return;}
      act('Date exclue ajoutée',async()=>{await q(client().from('v33_s2_excluded_dates').insert({starts_on:a,ends_on:b,label:String(f.get('l')).trim(),kind:f.get('k'),source:'manuel',validated:true}).select('id'));await audit('add_excluded',{a,b});});});
    v.addEventListener('click',e=>{const va=e.target.closest('[data-val]'),de=e.target.closest('[data-del]');
      if(va){const x=d.excluded.find(y=>y.id===va.dataset.val);act(x.validated?'Validation retirée':'Date validée',async()=>{await q(client().from('v33_s2_excluded_dates').update({validated:!x.validated}).eq('id',x.id).select('id'));await audit('validate_excluded',{id:x.id,validated:!x.validated});});}
      if(de&&confirm('Supprimer cette date exclue ?'))act('Date supprimée',async()=>{await q(client().from('v33_s2_excluded_dates').delete().eq('id',de.dataset.del).select('id'));await audit('delete_excluded',{id:de.dataset.del});});});
    v.querySelector('#v33-cal').addEventListener('change',e=>importCalendar(e.target.files[0]));
  }
  /* Lecture d'un calendrier Excel : on cherche les lignes qui contiennent une date (ou deux) et un mot-clé
     (vacances, férié, DS, examen, congé…). Tout est importé comme « proposition » à valider. */
  async function importCalendar(file){
    if(!file)return;if(!root.XLSX){alert('Le lecteur Excel n\'est pas chargé.');return;}
    const wb=root.XLSX.read(await file.arrayBuffer(),{cellDates:true});
    const props=[];const kw=/(vacance|f[ée]ri[ée]|cong[ée]|\bds\b|devoir|examen|rattrapage|f[êe]te|a[iï]d|mouled|ramadan|r[ée]volution|ind[ée]pendance|martyrs|travail)/i;
    const toIso=v=>{if(v instanceof Date&&!isNaN(v))return new Date(v.getTime()-v.getTimezoneOffset()*60000).toISOString().slice(0,10);
      const m=/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/.exec(String(v||''));if(!m)return null;const y=m[3].length===2?'20'+m[3]:m[3];return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;};
    for(const name of wb.SheetNames){
      const rows=root.XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,raw:true,defval:null});
      for(const r of rows){const text=r.filter(x=>typeof x==='string').join(' ');if(!kw.test(text))continue;
        const dates=r.map(toIso).filter(Boolean).concat((text.match(/\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}/g)||[]).map(toIso)).filter(x=>x>='2027-01-01'&&x<='2027-08-31').sort();
        if(!dates.length)continue;const label=norm(text).slice(0,160);const k=/vacance|cong/i.test(text)?'vacances':/\bds\b|devoir/i.test(text)?'ds':/examen/i.test(text)?'examen':/f[ée]ri|f[êe]te|a[iï]d/i.test(text)?'ferie':'autre';
        props.push({starts_on:dates[0],ends_on:dates[dates.length-1],label,kind:k,source:'calendrier',validated:false});}
    }
    const uniq=[...new Map(props.map(p=>[p.starts_on+p.ends_on+p.label,p])).values()];
    if(!uniq.length){alert('Aucune date de S2 reconnue dans ce fichier. Ajoutez les dates à la main.');return;}
    if(!confirm(`${uniq.length} proposition(s) trouvée(s) dans « ${file.name} » :\n\n${uniq.slice(0,25).map(p=>`${C().fmt(p.starts_on)}${p.ends_on!==p.starts_on?' → '+C().fmt(p.ends_on):''} : ${p.label}`).join('\n')}${uniq.length>25?'\n…':''}\n\nElles seront ajoutées comme propositions, à valider une par une. Continuer ?`))return;
    act(uniq.length+' proposition(s) importée(s) — à valider',async()=>{await q(client().from('v33_s2_excluded_dates').insert(uniq).select('id'));await audit('import_calendar',{file:file.name,n:uniq.length});});
  }

  /* ----- Paramètres ----- */
  function viewSettings(v,d){
    const s=d.settings;
    v.innerHTML=`<form id="v33-sform" class="v33-form"><label>Début du S2 <input type="date" name="start" min="2027-01-11" value="${s.start_date}" required></label>
      <label>Fin du S2 (facultatif) <input type="date" name="end" value="${s.end_date||''}"></label>
      <label>Nombre de groupes <input type="number" name="g" min="1" max="12" value="${s.group_count}"></label>
      <label>Nombre de manipulations <input type="number" name="m" min="1" max="9" value="${s.manip_count}"></label>
      <button class="btn btn-primary">Enregistrer</button></form>
      <h3>Créneaux des classes</h3><p class="v33-muted">Deux classes d'une même paire partagent le jour et les enseignants : « alternance » = une semaine chacune, « bloc » = toutes les séances de la première puis de la seconde (comme le vendredi au S1).</p>
      <table class="v33-table"><thead><tr><th>Classe</th><th>Jour</th><th>Début</th><th>Fin</th><th>Paire</th><th>Ordre</th><th>Mode</th><th>Active</th></tr></thead><tbody>
      ${d.slots.map(c=>`<tr data-c="${c.class_name}"><td>${c.class_name}</td><td><select name="w">${[1,2,3,4,5,6].map(w=>`<option value="${w}" ${w===c.weekday?'selected':''}>${C().DAY_LABEL[w]}</option>`).join('')}</select></td><td><input type="time" name="st" value="${c.start_time.slice(0,5)}"></td><td><input type="time" name="et" value="${c.end_time.slice(0,5)}"></td><td><input name="p" value="${esc(c.pair_key)}" size="9"></td><td><input type="number" name="o" min="1" max="9" value="${c.pair_order}" style="width:4em"></td><td><select name="mo"><option value="alternance" ${c.mode==='alternance'?'selected':''}>alternance</option><option value="bloc" ${c.mode==='bloc'?'selected':''}>bloc</option></select></td><td><input type="checkbox" name="a" ${c.active?'checked':''}></td></tr>`).join('')}</tbody></table>
      <button type="button" class="btn btn-primary" id="v33-slots-save">Enregistrer les créneaux</button>`;
    v.querySelector('#v33-sform').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.target);const start=f.get('start');
      if(start<'2027-01-11'){alert('Le S2 ne peut pas commencer avant le 11/01/2027.');return;}
      act('Paramètres enregistrés',async()=>{await q(client().from('v33_s2_settings').update({start_date:start,end_date:f.get('end')||null,group_count:Number(f.get('g')),manip_count:Number(f.get('m')),updated_at:new Date().toISOString()}).eq('id',1).select('id'));await audit('settings',{start});});});
    v.querySelector('#v33-slots-save').addEventListener('click',()=>{
      const rows=[...v.querySelectorAll('tr[data-c]')].map(tr=>({class_name:tr.dataset.c,weekday:Number(tr.querySelector('[name=w]').value),start_time:tr.querySelector('[name=st]').value,end_time:tr.querySelector('[name=et]').value,pair_key:tr.querySelector('[name=p]').value.trim()||tr.dataset.c,pair_order:Number(tr.querySelector('[name=o]').value)||1,mode:tr.querySelector('[name=mo]').value,active:tr.querySelector('[name=a]').checked,updated_at:new Date().toISOString()}));
      if(rows.some(r=>r.end_time<=r.start_time)){alert('Une heure de fin précède l\'heure de début.');return;}
      act('Créneaux enregistrés',async()=>{await q(client().from('v33_s2_class_slots').upsert(rows,{onConflict:'class_name'}).select('class_name'));await audit('class_slots',{rows});});});
  }

  /* ----- Versions et historique ----- */
  function viewVersions(v,d){
    v.innerHTML=`<h3>Versions enregistrées</h3><table class="v33-table"><thead><tr><th>Date</th><th>Nom</th><th></th></tr></thead><tbody>${d.versions.map(x=>`<tr><td>${new Date(x.created_at).toLocaleString('fr-FR')}</td><td>${esc(x.label)}</td><td><button type="button" class="btn btn-sm" data-rs="${x.id}">Restaurer</button></td></tr>`).join('')||'<tr><td colspan="3" class="v33-muted">Aucune version.</td></tr>'}</tbody></table>
      <h3>Historique récent</h3><ul class="v33-audit">${d.audit.map(a=>`<li>${new Date(a.created_at).toLocaleString('fr-FR')} · ${esc(tname(a.actor))} · ${esc(a.action)}</li>`).join('')||'<li class="v33-muted">Rien pour l\'instant.</li>'}</ul>`;
    v.addEventListener('click',e=>{const b=e.target.closest('[data-rs]');if(!b)return;
      if(confirm('Restaurer cette version ? Le planning actuel sera d\'abord sauvegardé, puis remplacé.'))act('Version restaurée',async()=>{await q(client().rpc('v33_s2_save_version',{p_label:'Sauvegarde automatique avant restauration'}));await q(client().rpc('v33_s2_restore_version',{p_id:b.dataset.rs}));});});
  }

  function init(){
    try{const s=root.localStorage.getItem(KEY);if(s==='S1'||s==='S2')state.sem=s;}catch(_){}
    mountTab();mountSwitch();setSemester(state.sem);
    root.addEventListener('v16:role-changed',()=>{state.data=null;if(isActive())render();});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  root.V33Semestres={render,reload:()=>{state.data=null;return render();},exportPdf};
})(typeof window!=='undefined'?window:globalThis);
