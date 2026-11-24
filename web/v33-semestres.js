/* V33 — Sélecteur S1/S2 et écran « Semestres ».
   Interface aérée : une chose à la fois (classe, jour, vue), actions immédiates à l'écran
   (mise à jour locale puis enregistrement en arrière-plan), synchronisation automatique
   toutes les 15 s et au retour sur l'onglet. Données S2 dans les tables v33_s2_*. */
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
  const VIEWS=[['planning','Planning','fa-calendar-days'],['groupes','Groupes','fa-people-group'],['enseignants','Enseignants','fa-chalkboard-user'],['manips','Manipulations','fa-flask'],['dates','Dates exclues','fa-calendar-xmark'],['parametres','Paramètres','fa-sliders'],['versions','Versions','fa-clock-rotate-left']];
  const state={sem:'S1',view:'planning',planView:'classe',planClass:'MPI1-A',planTeacher:'',planMonth:'all',groupClass:'MPI1-A',teacherDay:null,data:null,hash:'',busy:0,timer:null};

  /* ---------- Sélecteur de semestre ---------- */
  function setSemester(s){
    state.sem=s==='S2'?'S2':'S1';
    try{root.localStorage.setItem(KEY,state.sem);}catch(_){}
    document.querySelectorAll('#v33-sem-switch button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.sem===state.sem)));
    document.body.dataset.semester=state.sem;
    root.dispatchEvent(new CustomEvent('v33:semester',{detail:{semester:state.sem}}));
    if(isActive())render();
  }
  root.V33Semester={get:()=>state.sem,set:setSemester,range(s){return (s||state.sem)==='S2'?{from:C().S2_MIN_DATE,to:'2027-07-31'}:{from:S1_FROM,to:S1_TO};}};
  function mountSwitch(){
    if(document.getElementById('v33-sem-switch'))return;
    const host=document.querySelector('#fst-topbar .fst-heading')||document.getElementById('fst-topbar');if(!host)return;
    const box=document.createElement('div');box.id='v33-sem-switch';box.setAttribute('role','group');box.setAttribute('aria-label','Semestre');
    box.innerHTML='<button type="button" data-sem="S1">S1</button><button type="button" data-sem="S2">S2</button>';
    box.addEventListener('click',e=>{const b=e.target.closest('button[data-sem]');if(b)setSemester(b.dataset.sem);});
    host.appendChild(box);
  }
  function mountTab(){
    if(document.getElementById('semestres'))return;
    const main=document.getElementById('fst-main')||document.querySelector('.content');if(!main)return;
    const tab=document.createElement('div');tab.id='semestres';tab.className='tab-content';
    tab.innerHTML='<h2><i class="fas fa-layer-group"></i> Semestres</h2><div id="v33-root" class="v33x"></div>';
    main.appendChild(tab);
    new MutationObserver(()=>{if(isActive()){render();startSync();}else stopSync();}).observe(tab,{attributes:true,attributeFilter:['class']});
  }
  const isActive=()=>document.getElementById('semestres')?.classList.contains('active');

  /* ---------- Toasts ---------- */
  function toast(text,kind){
    let host=document.getElementById('v33-toasts');
    if(!host){host=document.createElement('div');host.id='v33-toasts';host.setAttribute('aria-live','polite');document.body.appendChild(host);}
    const t=document.createElement('div');t.className='v33-toast '+(kind||'ok');t.innerHTML=`<i class="fas ${kind==='err'?'fa-triangle-exclamation':'fa-circle-check'}"></i><span>${esc(text)}</span>`;
    host.appendChild(t);requestAnimationFrame(()=>t.classList.add('show'));
    setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),300);},kind==='err'?6000:2600);
  }

  /* ---------- Données ---------- */
  async function q(p){const {data,error}=await p;if(error)throw error;return data||[];}
  async function fetchAll(){
    const c=client();if(!c)throw new Error('Connexion indisponible');
    const [settings,manips,slots,stations,members,excluded,sessions,sslots,versions,profiles,students,audit]=await Promise.all([
      q(c.from('v33_s2_settings').select('*')),q(c.from('v33_s2_manipulations').select('*').eq('active',true).order('code')),
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
    const st=settings[0]||{start_date:'2027-01-11',group_count:5,manip_count:5,academic_year:'2026/2027'};
    const names=new Map(profiles.map(p=>[p.id,p.full_name||'—']));
    const studentRows=students.map(s=>{const cls=s.classes?.name||'';const m=/^(.*)-G(\d+)$/.exec(cls);return {id:s.id,name:norm((s.last_name||'')+' '+(s.first_name||'')),class_id:s.class_id,class_name:m?m[1]:cls,group_no:m?Number(m[2]):null};}).filter(s=>CLASSES.includes(s.class_name));
    return {settings:st,manips,slots,stations,members,excluded,sessions,versions,profiles,names,students:studentRows,studentById:new Map(studentRows.map(s=>[s.id,s])),audit};
  }
  const hashOf=d=>JSON.stringify([d.settings,d.manips,d.slots,d.stations,d.members,d.excluded,d.sessions,d.versions.map(v=>v.id)]);
  async function load(force){
    if(state.data&&!force)return state.data;
    const d=await fetchAll();state.data=d;state.hash=hashOf(d);return d;
  }
  /* Synchronisation silencieuse : recharge en arrière-plan et réaffiche seulement si quelque chose a changé
     (jamais pendant une saisie ou une fenêtre ouverte). */
  async function sync(){
    if(!isActive()||state.sem!=='S2'||state.busy||document.hidden||!state.data)return;
    try{const d=await fetchAll();const h=hashOf(d);if(h===state.hash)return;
      const editing=document.querySelector('.v33-modal')||document.activeElement?.closest?.('#v33-root input,#v33-root select,#v33-root textarea');
      if(editing)return;state.data=d;state.hash=h;renderView();toast('Mis à jour avec les dernières modifications');}catch(_){}
  }
  function startSync(){stopSync();state.timer=setInterval(sync,15000);}
  function stopSync(){if(state.timer)clearInterval(state.timer);state.timer=null;}
  root.addEventListener('focus',()=>sync());document.addEventListener('visibilitychange',()=>{if(!document.hidden)sync();});

  /* Action immédiate : on applique localement, on réaffiche, puis on enregistre. En cas d'erreur, on recharge. */
  async function mutate(label,local,remote){
    state.busy++;
    try{if(local)local(state.data);renderView();await remote();state.hash=hashOf(state.data);if(label)toast(label);}
    catch(e){console.error(e);toast('Échec : '+(e.message||e),'err');try{await load(true);}catch(_){}renderView();}
    finally{state.busy--;}
  }
  async function audit(action,detail){try{await client().from('v33_s2_audit').insert({action,detail});}catch(_){}}
  const tname=id=>id?(state.data?.names.get(id)||'—'):'—';
  const sname=id=>state.data?.studentById.get(id)?.name||'?';
  const short=n=>String(n||'').replace(/^Dr\.\s*/,'');

  /* ---------- Rendu ---------- */
  async function render(){
    const out=document.getElementById('v33-root');if(!out)return;
    if(state.sem==='S1'){renderS1(out);return;}
    if(!state.data)out.innerHTML='<div class="v33-skel"><i></i><i></i><i></i></div>';
    try{await load(false);}catch(e){out.innerHTML=`<div class="v33-empty"><i class="fas fa-plug-circle-exclamation"></i><p>Impossible de charger le S2 : ${esc(e.message)}</p></div>`;return;}
    const d=state.data,admin=isAdmin();
    const visible=admin?VIEWS:VIEWS.filter(v=>['planning','groupes','enseignants','manips','dates'].includes(v[0]));
    if(!visible.some(v=>v[0]===state.view))state.view='planning';
    out.innerHTML=`<div class="v33-hero"><div><span class="v33-tag">Semestre 2</span><h3>Planning des TP</h3><p>À partir du <b>${C().fmt(d.settings.start_date)}</b>${d.settings.end_date?' jusqu\'au <b>'+C().fmt(d.settings.end_date)+'</b>':''}${admin?'':' · lecture seule'}</p></div>
        <div class="v33-hero-stats" id="v33-herostats"></div></div>
      <nav class="v33-tabs" role="tablist">${visible.map(([k,l,i])=>`<button type="button" role="tab" data-view="${k}" aria-selected="${k===state.view}"><i class="fas ${i}"></i><span>${l}</span></button>`).join('')}</nav>
      <div id="v33-view" class="v33-view"></div>`;
    out.querySelector('.v33-tabs').onclick=e=>{const b=e.target.closest('[data-view]');if(!b)return;state.view=b.dataset.view;out.querySelectorAll('.v33-tabs [data-view]').forEach(x=>x.setAttribute('aria-selected',String(x===b)));renderView();};
    renderView();
  }
  function heroStats(d){
    const el=document.getElementById('v33-herostats');if(!el)return;
    el.innerHTML=`<div><b>${d.sessions.length}</b><span>séances</span></div><div><b>${d.members.filter(m=>m.status==='actif').length}</b><span>étudiants actifs</span></div><div><b>${new Set(d.stations.filter(s=>s.teacher_id).map(s=>s.teacher_id)).size}</b><span>enseignants</span></div>`;
  }
  function renderView(){
    const v=document.getElementById('v33-view');if(!v||!state.data)return;
    const d=state.data,admin=isAdmin();
    v.onclick=null;v.onchange=null;v.onsubmit=null;v.ondragstart=null;v.ondragover=null;v.ondrop=null;v.ondragend=null;
    ({planning:viewPlanning,groupes:viewGroups,enseignants:viewTeachers,manips:viewManips,dates:viewDates,parametres:viewSettings,versions:viewVersions})[state.view](v,d,admin);
    heroStats(d);
    v.classList.remove('v33-fade');void v.offsetWidth;v.classList.add('v33-fade');
  }

  async function renderS1(out){
    out.innerHTML=`<div class="v33-hero s1"><div><span class="v33-tag">Semestre 1</span><h3>Synthèse du S1</h3><p>Séances du 23/11 au 11/12/2026 protégées contre tout import ou recalcul automatique.</p></div></div><div id="v33-s1" class="v33-skel"><i></i><i></i><i></i></div>`;
    try{
      const rows=await q(client().from('sessions').select('id,session_date,classes(name),attendance(status)').gte('session_date',S1_FROM).lte('session_date',S1_TO).is('deleted_at',null));
      const by=new Map();
      for(const s of rows){const cls=(s.classes?.name||'').replace(/-G\d+$/,'');if(!CLASSES.includes(cls))continue;if(!by.has(cls))by.set(cls,{dates:new Set(),p:0,t:0});const b=by.get(cls);b.dates.add(s.session_date);for(const a of s.attendance||[]){b.t++;if(a.status!=='absent')b.p++;}}
      const el=document.getElementById('v33-s1');if(!el)return;el.className='v33-cards';
      el.innerHTML=CLASSES.map(cls=>{const b=by.get(cls)||{dates:new Set(),p:0,t:0};const r=b.t?Math.round(100*b.p/b.t):0;
        return `<div class="v33-card v33-clscard"><h4>${cls}</h4><div class="v33-big">${b.t?r+' %':'—'}</div><div class="v33-meter"><i style="width:${r}%"></i></div><p>${b.dates.size} date(s) de TP · ${b.t} présence(s)</p></div>`;}).join('')+
        `<p class="v33-muted v33-span">Détail dans « Statistiques ». Passez sur <b>S2</b> en haut de page pour préparer le second semestre.</p>`;
    }catch(e){const el=document.getElementById('v33-s1');if(el)el.textContent='Impossible de charger le S1 : '+e.message;}
  }
  const chips=(list,sel,attr,label)=>`<div class="v33-chips" role="tablist" aria-label="${label}">${list.map(([k,l,extra])=>`<button type="button" class="v33-chip ${k===sel?'on':''}" data-${attr}="${esc(k)}" aria-pressed="${k===sel}"><span>${esc(l)}</span>${extra!=null?`<small>${esc(extra)}</small>`:''}</button>`).join('')}</div>`;

  /* ----- Planning ----- */
  function viewPlanning(v,d,admin){
    const issues=d.sessions.length?C().checkPlan({settings:d.settings,excluded:d.excluded,sessions:d.sessions}):[];
    const errors=issues.filter(i=>i.level==='erreur'),warns=issues.filter(i=>i.level==='attention'),infos=issues.filter(i=>i.level==='info');
    const teachers=[...new Set(d.sessions.flatMap(s=>s.slots.map(g=>g.teacher_id)).filter(Boolean))].sort((a,b)=>tname(a).localeCompare(tname(b)));
    if(!teachers.includes(state.planTeacher))state.planTeacher=teachers[0]||'';
    const status=!d.sessions.length?'':errors.length?`<button type="button" class="v33-status err" data-issues><i class="fas fa-circle-xmark"></i> ${errors.length} erreur(s)</button>`:warns.length?`<button type="button" class="v33-status warn" data-issues><i class="fas fa-circle-exclamation"></i> ${warns.length} point(s) à vérifier</button>`:`<button type="button" class="v33-status ok" data-issues><i class="fas fa-circle-check"></i> Planning cohérent</button>`;
    v.innerHTML=`
      ${admin?`<section class="v33-card v33-actions-card"><div class="v33-row">
          <button type="button" class="btn btn-primary v33-btn" data-act="gen"><i class="fas fa-wand-magic-sparkles"></i> ${d.sessions.length?'Regénérer':'Générer le planning'}</button>
          <div class="v33-inline"><label for="v33-from">Recalculer à partir du</label><input type="date" id="v33-from" min="${d.settings.start_date}" value="${d.settings.start_date}"><button type="button" class="btn v33-btn ghost" data-act="regen">Recalculer</button></div>
          <button type="button" class="btn v33-btn ghost" data-act="version"><i class="fas fa-bookmark"></i> Version</button></div>
          <p class="v33-muted v33-autonote"><i class="fas fa-rotate"></i> Recalcul automatique : chaque date ou semaine exclue ajoutée, validée ou retirée replanifie le S2 à partir de cette date (sauvegarde faite avant, séances verrouillées conservées). Fin du S2 : ${d.settings.end_date?C().fmt(d.settings.end_date):'non fixée'}.</p></section>${shareCard(d)}`:''}
      ${d.sessions.length?`<div class="v33-toolbar">
        <div class="v33-seg" role="tablist" aria-label="Vue">${[['classe','Par classe'],['enseignant','Par enseignant'],['semaine','Par semaine']].map(([k,l])=>`<button type="button" data-pv="${k}" aria-pressed="${k===state.planView}">${l}</button>`).join('')}</div>
        <div class="v33-grow"></div>${status}
        <button type="button" class="btn v33-btn ghost" data-act="pdf"><i class="fas fa-file-pdf"></i> PDF</button><button type="button" class="btn v33-btn ghost" data-act="pdfall"><i class="fas fa-file-pdf"></i> Toutes</button><button type="button" class="btn v33-btn ghost" data-act="book" title="Cahier de présence du jour de la classe choisie : page de garde puis une page par groupe"><i class="fas fa-book"></i> Cahier</button><button type="button" class="btn v33-btn ghost" data-act="bookall"><i class="fas fa-book"></i> Tous les cahiers</button></div>
        ${monthChips(d)}
        ${state.planView==='classe'?chips(CLASSES.map(c=>[c,c,d.sessions.filter(s=>s.class_name===c).length+' séances']),state.planClass,'pc','Classe'):''}
        ${state.planView==='enseignant'?chips(teachers.map(t=>[t,short(tname(t)),null]),state.planTeacher,'pt','Enseignant'):''}
        <div id="v33-issues" hidden class="v33-card">${errors.concat(warns).concat(infos).map(i=>`<p class="v33-issue ${i.level}">${esc(i.text)}</p>`).join('')||'<p class="v33-issue info">Chaque date respecte le début du S2 et les dates exclues validées, sans enseignant en double.</p>'}</div>
        <div id="v33-plan"></div>`:
        `<div class="v33-empty"><i class="fas fa-calendar-plus"></i><h4>Aucune séance S2 pour l'instant</h4><p>${admin?'1. Renseignez les <b>enseignants</b> (une par manipulation, pour chaque jour). 2. Vérifiez les <b>dates exclues</b>. 3. Cliquez sur « Générer le planning ».':'Le planning sera visible ici dès qu\'il aura été généré.'}</p></div>`}`;
    v.onclick=e=>{
      const pv=e.target.closest('[data-pv]'),pc=e.target.closest('[data-pc]'),pt=e.target.closest('[data-pt]');
      if(pv){state.planView=pv.dataset.pv;return renderView();}
      if(pc){state.planClass=pc.dataset.pc;return renderView();}
      if(pt){state.planTeacher=pt.dataset.pt;return renderView();}
      const pm=e.target.closest('[data-pm]');if(pm){state.planMonth=pm.dataset.pm;return renderView();}
      if(e.target.closest('[data-issues]')){const b=v.querySelector('#v33-issues');b.hidden=!b.hidden;return;}
      const sm=e.target.closest('[data-share]');if(sm)return setShareMode(sm.dataset.share,sm.dataset.mode,d);
      if(e.target.closest('[data-act]'))return toolbar(e,d);
      planClick(e,d);
    };
    const plan=v.querySelector('#v33-plan');if(!plan)return;
    const dv=state.planMonth==='all'?d:Object.assign({},d,{sessions:d.sessions.filter(s=>s.session_date.slice(0,7)===state.planMonth)});
    if(state.planView==='classe')planByClass(plan,dv,admin);else if(state.planView==='enseignant')planByTeacher(plan,dv);else planByWeek(plan,dv);
  }
  const MONTHS=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  function monthChips(d){
    const ms=[...new Set(d.sessions.map(s=>s.session_date.slice(0,7)))].sort();
    if(ms.length<2)return '';
    if(state.planMonth!=='all'&&!ms.includes(state.planMonth))state.planMonth='all';
    return `<div class="v33-seg v33-months" role="tablist" aria-label="Mois"><button type="button" data-pm="all" aria-pressed="${state.planMonth==='all'}">Tout le S2</button>${ms.map(m=>`<button type="button" data-pm="${m}" aria-pressed="${m===state.planMonth}">${MONTHS[Number(m.slice(5))-1].replace(/^./,c=>c.toUpperCase())}</button>`).join('')}</div>`;
  }
  async function toolbar(e,d){
    const a=e.target.closest('[data-act]').dataset.act;
    if(a==='pdf')return exportPdf(state.planView==='classe'?[state.planClass]:CLASSES,d);
    if(a==='pdfall')return exportPdf(CLASSES,d);
    if(a==='book')return exportBook([state.planClass],d);
    if(a==='bookall')return exportBook(CLASSES,d);
    if(a==='version'){const label=prompt('Nom de la version :','Version du '+new Date().toLocaleDateString('fr-FR'));if(!label)return;
      return mutate('Version enregistrée',null,async()=>{await q(client().rpc('v33_s2_save_version',{p_label:label.slice(0,120)}));state.data.versions=await q(client().from('v33_s2_versions').select('id,label,created_at').order('created_at',{ascending:false}));});}
    if(a==='gen'||a==='regen'){
      const from=a==='gen'?d.settings.start_date:(document.getElementById('v33-from').value||d.settings.start_date);
      const kept=d.sessions.filter(s=>s.locked||s.session_date<from);
      if(!d.stations.some(s=>s.teacher_id)&&!confirm('Aucun enseignant n\'est encore affecté. Générer quand même ?'))return;
      const {sessions,warnings}=C().generatePlan({settings:d.settings,classSlots:d.slots,stations:d.stations,manipulations:d.manips,excluded:d.excluded,kept,fromDate:from});
      const replaced=d.sessions.filter(s=>!s.locked&&s.session_date>=from).length;
      if(!confirm(`${sessions.length} séance(s) à partir du ${C().fmt(from)}.${replaced?`\n${replaced} séance(s) non verrouillée(s) remplacée(s).`:''}${kept.length?`\n${kept.length} séance(s) conservée(s).`:''}${warnings.length?'\n\n'+warnings.join('\n'):''}\n\nUne sauvegarde est faite avant. Continuer ?`))return;
      state.busy++;
      try{if(d.sessions.length)await q(client().rpc('v33_s2_save_version',{p_label:'Sauvegarde automatique avant recalcul du '+C().fmt(from)}));
        await q(client().rpc('v33_s2_replace_plan',{p_from:from,p_sessions:sessions,p_reason:a==='gen'?'génération':'recalcul ciblé'}));
        await load(true);toast(`Planning enregistré : ${sessions.length} séance(s)`);}catch(err){toast('Échec : '+err.message,'err');}
      finally{state.busy--;}
      renderView();
    }
  }
  function cell(g){return g?`<span class="v33-m">${esc(g.manipulation_code)}</span><span class="v33-room">${g.room?'Salle '+esc(g.room):''}</span><span class="v33-t">${esc(short(tname(g.teacher_id)))}</span>`:'—';}
  function planByClass(box,d,admin){
    const cls=state.planClass;const list=d.sessions.filter(s=>s.class_name===cls);
    const slot=d.slots.find(s=>s.class_name===cls);const G=d.settings.group_count;
    if(!list.length){box.innerHTML=`<div class="v33-empty small"><p>Aucune séance pour ${cls}.</p></div>`;return;}
    const ex=C().excludedMap(d.excluded);const rows=[];
    for(let x=list[0].session_date;x<=list[list.length-1].session_date;x=C().addDays(x,7))if(ex.has(x)&&!list.some(s=>s.session_date===x))rows.push({ex:ex.get(x),date:x});
    for(const s of list)rows.push({s,date:s.session_date});rows.sort((a,b)=>a.date.localeCompare(b.date));
    box.innerHTML=`<div class="v33-card v33-plan-card"><header class="v33-plan-head"><div><h4>${cls}</h4><span>${slot?C().DAY_LABEL[slot.weekday]+' · '+slot.start_time.slice(0,5)+' – '+slot.end_time.slice(0,5):''}</span></div>${admin?'<span class="v33-muted">Touchez une case pour la modifier</span>':''}</header>
      <div class="v33-scroll"><table class="v33-grid"><thead><tr><th>Date</th>${Array.from({length:G},(_,i)=>`<th>G${i+1}</th>`).join('')}${admin?'<th></th>':''}</tr></thead><tbody>
      ${rows.map(r=>r.ex?`<tr class="v33-exrow"><td>${C().fmt(r.date)}</td><td colspan="${G+(admin?1:0)}"><i class="fas fa-ban"></i> ${esc(r.ex)} — aucun TP</td></tr>`:
        `<tr class="${r.s.locked?'locked':''}"><td><b>${C().fmt(r.date)}</b><small>passage ${r.s.occurrence}</small></td>${Array.from({length:G},(_,i)=>{const x=r.s.slots.find(y=>y.group_no===i+1);return `<td>${admin&&x?`<button type="button" class="v33-cellbtn ${x.locked?'locked':''}" data-slot="${x.id}" aria-label="Modifier G${i+1} du ${C().fmt(r.date)}">${cell(x)}</button>`:`<div class="v33-cellbtn ro">${cell(x)}</div>`}</td>`;}).join('')}
        ${admin?`<td class="v33-rowact"><button type="button" class="v33-icon" data-lock="${r.s.id}" title="${r.s.locked?'Déverrouiller':'Verrouiller (gardée par les recalculs)'}"><i class="fas ${r.s.locked?'fa-lock':'fa-lock-open'}"></i></button><button type="button" class="v33-icon" data-move="${r.s.id}" title="Changer la date"><i class="fas fa-calendar-day"></i></button></td>`:''}</tr>`).join('')}
      </tbody></table></div></div>`;
  }
  /* ----- Classes qui partagent un jour (« paires ») ----- */
  function pairsOf(d){
    const act=d.slots.filter(s=>s.active!==false),m=new Map();
    for(const s of act){if(!m.has(s.pair_key))m.set(s.pair_key,[]);m.get(s.pair_key).push(s);}
    return [...m].map(([key,l])=>({key,list:l.sort((a,b)=>a.pair_order-b.pair_order||a.class_name.localeCompare(b.class_name)),weekday:l[0].weekday,mode:l[0].mode||'alternance'}))
      .sort((a,b)=>a.weekday-b.weekday||a.key.localeCompare(b.key));
  }
  function shareCard(d){
    const pairs=pairsOf(d).filter(p=>p.list.length>1);if(!pairs.length)return '';
    return `<section class="v33-card"><h4 class="v33-h">Partage des jours entre classes</h4><p class="v33-muted">Deux classes qui partagent un jour peuvent alterner chaque semaine, ou faire toutes leurs séances l'une après l'autre comme au S1. Changer de choix recalcule le planning (sauvegarde faite avant, séances verrouillées conservées).</p>
      ${pairs.map(p=>{const n=p.list.map(c=>c.class_name);return `<div class="v33-item"><div><b>${C().DAY_LABEL[p.weekday]} — ${n.join(' et ')}</b><small>${p.mode==='bloc'?`Toutes les séances de ${n[0]}, puis celles de ${n.slice(1).join(', ')}`:'Une semaine chacune, à tour de rôle'}</small></div>
        <div class="v33-seg" role="radiogroup" aria-label="Partage du ${C().DAY_LABEL[p.weekday]}"><button type="button" data-share="${esc(p.key)}" data-mode="alternance" aria-pressed="${p.mode!=='bloc'}">Semaine par semaine</button><button type="button" data-share="${esc(p.key)}" data-mode="bloc" aria-pressed="${p.mode==='bloc'}">Comme au S1</button></div></div>`;}).join('')}</section>`;
  }
  async function setShareMode(key,mode,d){
    const p=pairsOf(d).find(x=>x.key===key);if(!p||p.mode===mode)return;
    const n=p.list.map(c=>c.class_name).join(' et ');
    if(d.sessions.length&&!confirm(`${n} : ${mode==='bloc'?'toutes les séances de '+p.list[0].class_name+' puis celles de '+p.list.slice(1).map(c=>c.class_name).join(', ')+' (comme au S1)':'une semaine chacune'}.\n\nLe planning sera recalculé à partir du ${C().fmt(d.settings.start_date)} (sauvegarde faite avant). Continuer ?`))return;
    state.busy++;
    try{
      await q(client().from('v33_s2_class_slots').update({mode,updated_at:new Date().toISOString()}).eq('pair_key',key).select('class_name'));
      audit('class_slots',{pair:key,mode});
      if(d.sessions.length){const r=await q(client().rpc('v37_s2_auto_replan',{p_from:d.settings.start_date,p_reason:'partage '+key+' : '+mode,p_force:false}));
        await load(true);toast(`Partage enregistré — ${r?.inserted??''} séance(s) replanifiée(s)`);}
      else{await load(true);toast('Partage enregistré');}
    }catch(err){toast('Échec : '+err.message,'err');}finally{state.busy--;}
    renderView();
  }
  function planClick(e,d){
    const lk=e.target.closest('[data-lock]'),mv=e.target.closest('[data-move]'),sl=e.target.closest('[data-slot]');
    if(lk){const s=d.sessions.find(x=>x.id===lk.dataset.lock);const v=!s.locked;
      return mutate(v?'Séance verrouillée':'Séance déverrouillée',()=>{s.locked=v;},async()=>{await q(client().from('v33_s2_sessions').update({locked:v}).eq('id',s.id).select('id'));audit(v?'lock':'unlock',{session:s.id});});}
    if(mv){const s=d.sessions.find(x=>x.id===mv.dataset.move);
      modal(`Déplacer ${esc(s.class_name)} du ${C().fmt(s.session_date)}`,`<label>Nouvelle date<input type="date" id="v33-nd" min="${d.settings.start_date}" value="${s.session_date}"></label><p class="v33-muted">La séance sera verrouillée.</p>`,dlg=>{
        const nd=dlg.querySelector('#v33-nd').value;if(!nd||nd===s.session_date)return;
        if(nd<d.settings.start_date){toast('Le S2 commence le '+C().fmt(d.settings.start_date),'err');return;}
        if(C().excludedMap(d.excluded).has(nd)&&!confirm('Cette date est exclue. Continuer ?'))return;
        const old=s.session_date;
        mutate('Séance déplacée et verrouillée',()=>{s.session_date=nd;s.locked=true;d.sessions.sort((a,b)=>a.session_date.localeCompare(b.session_date));},async()=>{await q(client().from('v33_s2_sessions').update({session_date:nd,locked:true}).eq('id',s.id).select('id'));audit('move',{session:s.id,from:old,to:nd});});});return;}
    if(sl)editSlot(sl.dataset.slot,d);
  }
  function modal(title,body,onOk){
    const dlg=document.createElement('div');dlg.className='v33-modal';dlg.setAttribute('role','dialog');dlg.setAttribute('aria-modal','true');
    dlg.innerHTML=`<div class="v33-modal-box"><h3>${title}</h3>${body}<div class="v33-actions"><button type="button" class="btn v33-btn ghost" data-x>Annuler</button><button type="button" class="btn btn-primary v33-btn" data-ok>Enregistrer</button></div></div>`;
    document.body.appendChild(dlg);requestAnimationFrame(()=>dlg.classList.add('show'));dlg.querySelector('select,input')?.focus();
    const close=()=>{dlg.classList.remove('show');setTimeout(()=>dlg.remove(),180);};
    dlg.addEventListener('click',e=>{if(e.target===dlg||e.target.closest('[data-x]'))close();if(e.target.closest('[data-ok]')){close();onOk(dlg);}});
    dlg.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  }
  function editSlot(id,d){
    const s=d.sessions.find(x=>x.slots.some(y=>y.id===id));const g=s.slots.find(y=>y.id===id);
    modal(`${esc(s.class_name)} · ${C().fmt(s.session_date)} · G${g.group_no}`,
      `<label>Manipulation<select id="v33-e-m">${d.manips.map(m=>`<option value="${m.code}" ${m.code===g.manipulation_code?'selected':''}>${m.code}${m.title?' — '+esc(m.title):''}</option>`).join('')}</select></label>
       <label>Enseignant<select id="v33-e-t"><option value="">—</option>${d.profiles.slice().sort((a,b)=>String(a.full_name).localeCompare(String(b.full_name))).map(p=>`<option value="${p.id}" ${p.id===g.teacher_id?'selected':''}>${esc(p.full_name)}</option>`).join('')}</select></label>
       <label>Salle<input id="v33-e-r" value="${esc(g.room||'')}" maxlength="40"></label><p class="v33-muted">La case sera verrouillée : les recalculs ne la changeront plus.</p>`,
      dlg=>{const patch={manipulation_code:dlg.querySelector('#v33-e-m').value,teacher_id:dlg.querySelector('#v33-e-t').value||null,room:dlg.querySelector('#v33-e-r').value.trim()||null,locked:true};const before={...g};
        mutate('Case modifiée',()=>{Object.assign(g,patch);s.locked=true;},async()=>{await q(client().from('v33_s2_slots').update(patch).eq('id',id).select('id'));await q(client().from('v33_s2_sessions').update({locked:true}).eq('id',s.id).select('id'));audit('edit_slot',{slot:id,before:{m:before.manipulation_code,t:before.teacher_id,r:before.room},after:patch});});});
  }
  function planByTeacher(box,d){
    const rows=d.sessions.flatMap(s=>s.slots.filter(g=>g.teacher_id===state.planTeacher).map(g=>({s,g})));
    box.innerHTML=rows.length?`<div class="v33-list">${rows.map(({s,g})=>`<div class="v33-item"><div class="v33-date"><b>${C().fmt(s.session_date).slice(0,5)}</b><small>${C().DAY_LABEL[C().weekdayOf(s.session_date)]}</small></div><div><b>${s.class_name} · G${g.group_no}</b><small>${s.start_time} – ${s.end_time}${g.room?' · Salle '+esc(g.room):''}</small></div><span class="v33-m big">${g.manipulation_code}</span></div>`).join('')}</div><p class="v33-muted">${rows.length} créneau(x).</p>`:'<div class="v33-empty small"><p>Aucun créneau.</p></div>';
  }
  function planByWeek(box,d){
    const weeks=new Map();
    for(const s of d.sessions){const w=C().addDays(s.session_date,1-C().weekdayOf(s.session_date));if(!weeks.has(w))weeks.set(w,[]);weeks.get(w).push(s);}
    box.innerHTML=`<div class="v33-weeks">${[...weeks].map(([w,list])=>`<section class="v33-card v33-week"><h4>Semaine du ${C().fmt(w)}</h4>${list.map(s=>`<div class="v33-item"><div class="v33-date"><b>${C().fmt(s.session_date).slice(0,5)}</b><small>${C().DAY_LABEL[C().weekdayOf(s.session_date)]}</small></div><div><b>${s.class_name}</b><small>passage ${s.occurrence} · ${s.start_time} – ${s.end_time}</small></div>${s.locked?'<i class="fas fa-lock v33-muted"></i>':''}</div>`).join('')}</section>`).join('')}</div>`;
  }

  /* ----- PDF (modèle du S1) : une page par jour partagé — les classes qui alternent sont sur la même feuille ----- */
  async function exportPdf(classes,d){
    const jsPDF=root.jspdf?.jsPDF;if(!jsPDF){toast('Le moteur PDF n\'est pas chargé.','err');return;}
    const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
    const ex=C().excludedMap(d.excluded);let first=true;
    const pairs=pairsOf(d),seen=new Set(),pages=[];
    for(const cls of classes){const p=pairs.find(x=>x.list.some(c=>c.class_name===cls));const k=p?p.key:cls;if(seen.has(k))continue;seen.add(k);pages.push(p||{key:cls,list:[{class_name:cls}],mode:'alternance'});}
    pages.sort((a,b)=>(a.weekday||9)-(b.weekday||9));
    const TINT=[[255,250,214],[226,239,218],[222,235,247]];
    // La police du PDF ne dessine que l'alphabet latin : un libellé en arabe est remplacé par le type de date.
    const exLabel=x=>{const t=ex.get(x)||'';if(!/[^\u0000-\u024F\u2000-\u206F]/.test(t))return t;const e=(d.excluded||[]).find(e=>e.starts_on<=x&&x<=e.ends_on&&e.label===t);return KIND[e?.kind]||'Date exclue';};
    for(const pg of pages){
      const names=pg.list.map(c=>c.class_name);
      const list=d.sessions.filter(s=>names.includes(s.class_name)).sort((a,b)=>a.session_date.localeCompare(b.session_date));if(!list.length)continue;
      if(!first)doc.addPage();first=false;
      const slot=d.slots.find(s=>s.class_name===names[0]);const G=d.settings.group_count;const multi=names.length>1;
      const rows=[];const a=list[0].session_date,b=list[list.length-1].session_date;
      for(let x=a;x<=b;x=C().addDays(x,7))if(ex.has(x)&&!list.some(s=>s.session_date===x))rows.push({date:x,ex:exLabel(x)});
      for(const s of list)rows.push({date:s.session_date,s});rows.sort((p,q2)=>p.date.localeCompare(q2.date));
      const X=14,W=269,c0=multi?30:36,c1=multi?24:0,cw=(W-c0-c1)/G;let y=10;
      const box=(x,yy,w,h,fill)=>{if(fill){doc.setFillColor(...fill);doc.rect(x,yy,w,h,'FD');}else doc.rect(x,yy,w,h);};
      doc.setDrawColor(40);doc.setLineWidth(0.2);
      const levels=[...new Set(names.map(n=>n.split('-')[0]))].join(' / ');
      box(X,y,W,8,[243,241,234]);doc.setFont('helvetica','bold');doc.setFontSize(10);doc.setTextColor(20);doc.text(`[${levels}] - [${d.settings.academic_year}] - [SEMESTRE 2]`,X+W/2,y+5.5,{align:'center'});y+=8;
      box(X,y,W,12,[243,241,234]);doc.setFontSize(16);doc.text('PLANNING DES TP DE PHYSIQUE',X+W/2,y+8.3,{align:'center'});y+=12;
      box(X,y,W,9,[255,242,0]);doc.setFontSize(12);doc.text(names.join('  /  ')+(multi?(pg.mode==='bloc'?'   (l\'une après l\'autre, comme au S1)':'   (une semaine sur deux)'):''),X+W/2,y+6.3,{align:'center'});y+=9;
      box(X,y,c0,9);doc.setTextColor(190,0,0);doc.setFontSize(9);doc.text(slot?C().DAY_LABEL[slot.weekday]:'',X+c0/2,y+6,{align:'center'});doc.setTextColor(20);
      if(multi){box(X+c0,y,c1,9,[221,235,247]);doc.text('Classe',X+c0+c1/2,y+6,{align:'center'});}
      for(let g=0;g<G;g++){box(X+c0+c1+g*cw,y,cw,9,[221,235,247]);doc.text('G'+(g+1),X+c0+c1+g*cw+cw/2,y+6,{align:'center'});}y+=9;
      box(X,y,c0,8);doc.setFontSize(8.5);doc.text(slot?`${slot.start_time.slice(0,5).replace(':','H')} - ${slot.end_time.slice(0,5).replace(':','H')}`:'',X+c0/2,y+5.5,{align:'center'});if(multi)box(X+c0,y,c1,8);for(let g=0;g<G;g++)box(X+c0+c1+g*cw,y,cw,8);y+=8;
      const legend=(d.manips||[]).filter(m=>m.title&&!/[^\u0000-\u024F\u2000-\u206F]/.test(m.title)).map(m=>`${m.code} : ${m.title}`).join('    ·    ');
      const recap=slot?(d.manips||[]).filter(m=>m.active!==false).map(m=>{const st=(d.stations||[]).find(x=>x.weekday===slot.weekday&&x.manipulation_code===m.code);return st&&st.teacher_id?`${m.code} : ${tname(st.teacher_id)}`:null;}).filter(Boolean).join('    ·    '):'';
      const rh=Math.min(17,(195-y-10-(legend?6:0)-(recap?6:0))/Math.max(rows.length,1));doc.setFontSize(10);
      for(const r of rows){
        if(r.ex){box(X,y,c0,rh,[252,229,180]);box(X+c0,y,W-c0,rh,[252,229,180]);doc.setFontSize(10);doc.text(C().fmt(r.date),X+c0/2,y+rh/2+1.6,{align:'center'});doc.setTextColor(190,0,0);doc.text(`${r.ex} - aucun TP`,X+c0+(W-c0)/2,y+rh/2+1.5,{align:'center'});doc.setTextColor(20);}
        else{const tint=multi?TINT[names.indexOf(r.s.class_name)%TINT.length]:null;
          box(X,y,c0,rh,tint);doc.setFontSize(10);doc.text(C().fmt(r.date),X+c0/2,y+rh/2+1.6,{align:'center'});
          if(multi){box(X+c0,y,c1,rh,tint);doc.text(r.s.class_name,X+c0+c1/2,y+rh/2+1.6,{align:'center'});}doc.setFontSize(9.5);
          doc.setTextColor(31,73,125);
          for(let g=0;g<G;g++){const x=r.s.slots.find(z=>z.group_no===g+1);box(X+c0+c1+g*cw,y,cw,rh);if(x){doc.text(`${x.manipulation_code}${x.room?' - Salle '+x.room:''}`,X+c0+c1+g*cw+cw/2,y+rh/2,{align:'center'});doc.setFontSize(7.5);doc.setFont('helvetica','normal');doc.text(tname(x.teacher_id),X+c0+c1+g*cw+cw/2,y+rh/2+4,{align:'center'});doc.setFontSize(9.5);doc.setFont('helvetica','bold');}}
          doc.setTextColor(20);}
        y+=rh;
      }
      const lastOf=n=>{const l=list.filter(s=>s.class_name===n);return l.length?l[l.length-1].session_date:null;};
      const foot=names.map(n=>{const l=lastOf(n);return l?`${n} : dernière séance ${C().DAY_LABEL[C().weekdayOf(l)].toLowerCase()} ${C().fmt(l)}`:null;}).filter(Boolean).join('   ·   ');
      box(X,y,W,8,[230,230,230]);doc.setFont('helvetica','italic');doc.setFontSize(8);doc.text(`Planning arrêté au ${C().fmt(C().addDays(b,1))} - ${foot}`,X+W/2,y+5.3,{align:'center'});doc.setFont('helvetica','bold');
      if(legend){y+=8;box(X,y,W,6,[243,241,234]);doc.setFontSize(8.5);doc.setTextColor(20);doc.text(legend,X+W/2,y+4.1,{align:'center',maxWidth:W-4});}
      if(recap){y+=legend?6:8;box(X,y,W,6,[221,235,247]);doc.setFontSize(8.5);doc.setTextColor(20);doc.text(`Intervenants du ${(C().DAY_LABEL[slot.weekday]||'').toLowerCase()} : ${recap}`,X+W/2,y+4.1,{align:'center',maxWidth:W-4});}
    }
    if(first){toast('Aucune séance à exporter.','err');return;}
    doc.save(pages.length===1?`Planning_${pages[0].list.map(c=>c.class_name).join('_')}_TP_Physique_S2.pdf`:'Planning_TP_Physique_S2.pdf');
  }

  /* ----- Cahier de présence (modèle du cahier papier) : page de garde par jour, puis une page par classe et par groupe ----- */
  const GROUP_RGB=[[61,124,201],[91,154,60],[236,196,64],[232,131,58],[181,72,122],[106,90,205]];
  const CLASS_RGB=[[207,221,240],[235,207,214],[222,235,210]];
  const EXKIND={ds:'Semaine des DS',vacances:'Vacances',ferie:'Jour férié',examen:'Examens',autre:'Date exclue'};
  async function exportBook(classes,d){
    const jsPDF=root.jspdf?.jsPDF;if(!jsPDF){toast('Le moteur PDF n\'est pas chargé.','err');return;}
    if(!d.members.some(m=>m.status==='actif')){toast('Préparez d\'abord les groupes du S2 (onglet Groupes).','err');return;}
    const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
    const F=C().fmt,G=d.settings.group_count,DAY=C().DAY_LABEL;
    const latin=t=>!/[^\u0000-ɏ -⁯]/.test(t||'');
    const exText=e=>{const lab=latin(e.label)&&e.label?e.label:(EXKIND[e.kind]||'Date exclue');return `${lab} : ${e.starts_on===e.ends_on?'le '+F(e.starts_on):'du '+F(e.starts_on)+' au '+F(e.ends_on)} — aucun TP`;};
    const exList=(d.excluded||[]).filter(e=>e.validated!==false&&e.ends_on>=d.settings.start_date&&(!d.settings.end_date||e.starts_on<=d.settings.end_date)).sort((a,b)=>a.starts_on.localeCompare(b.starts_on));
    const onDay=(e,wd)=>{for(let x=e.starts_on;x<=e.ends_on;x=C().addDays(x,1))if(C().weekdayOf(x)===wd)return true;return false;};
    const exShort=e=>{const lab=latin(e.label)&&e.label?e.label:(EXKIND[e.kind]||'Date exclue');const f=x=>F(x).slice(0,5);return `${lab} ${e.starts_on===e.ends_on?F(e.starts_on):f(e.starts_on)+' – '+F(e.ends_on)}`;};
    const pairs=pairsOf(d),seen=new Set(),books=[];
    for(const cls of classes){const p=pairs.find(x=>x.list.some(c=>c.class_name===cls));const k=p?p.key:cls;if(seen.has(k))continue;seen.add(k);books.push(p||{key:cls,list:[d.slots.find(s=>s.class_name===cls)||{class_name:cls,weekday:1,start_time:'14:00',end_time:'17:00'}],weekday:1});}
    books.sort((a,b)=>a.weekday-b.weekday);
    const W=297,M=14,IW=W-2*M;let first=true;
    const page=()=>{if(!first)doc.addPage();first=false;};
    const band=(x,y,w,h,rgb,txt,size,color,bold=true)=>{doc.setFillColor(...rgb);doc.setDrawColor(40);doc.setLineWidth(0.3);doc.rect(x,y,w,h,'FD');if(txt!=null){doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);doc.setTextColor(...(color||[30,30,30]));doc.text(String(txt),x+w/2,y+h/2+size*0.13,{align:'center'});}};
    const hhmm=t=>String(t||'').slice(0,5).replace(':','H');
    const ink=rgb=>(rgb[0]*0.299+rgb[1]*0.587+rgb[2]*0.114)>165?[30,30,30]:[255,255,255];
    for(const bk of books){
      const names=bk.list.map(c=>c.class_name),day=DAY[bk.weekday]||'',slot=bk.list[0];
      const hours=`${hhmm(slot.start_time)} – ${hhmm(slot.end_time)}`;
      /* Page de garde */
      page();let y=22;
      doc.setFont('helvetica','bold');doc.setFontSize(10.5);doc.setTextColor(40);doc.text('UNIVERSITÉ DE TUNIS EL MANAR — FACULTÉ DES SCIENCES DE TUNIS',W/2,y,{align:'center'});y+=7;
      band(M+12,y,IW-24,11,[243,239,200],'CAHIER DE PRÉSENCE — TRAVAUX PRATIQUES DE PHYSIQUE',15);y+=15;
      band(M+12,y,IW-24,10,[215,215,215],day.toUpperCase(),16);y+=10;
      const cw=(IW-24)/names.length;names.forEach((n,i)=>band(M+12+i*cw,y,cw,10,CLASS_RGB[i%CLASS_RGB.length],n,14));y+=18;
      doc.setFont('helvetica','bold');doc.setFontSize(11);doc.setTextColor(30);doc.text(`Année universitaire ${d.settings.academic_year||''} — Semestre 2`,W/2,y,{align:'center'});y+=6;
      doc.setFont('helvetica','normal');doc.text(`Horaire : ${hours} — ${G} groupes par classe`,W/2,y,{align:'center'});y+=4;
      for(const e of exList){if(!onDay(e,bk.weekday))continue;
        band(M+12,y,IW-24,7,[244,176,120],exText(e).toUpperCase(),9.5);y+=7.5;}
      y+=5;band(M+12,y,IW-24,7,[243,239,200],'LÉGENDE DES MANIPULATIONS',10.5);y+=11;
      doc.setFontSize(9.5);doc.setFont('helvetica','bold');doc.text('Code',M+16,y);doc.text('Intitulé',M+110,y,{align:'center'});doc.text('Salle',W-M-28,y,{align:'center'});y+=1.5;doc.setLineWidth(0.4);doc.line(M+12,y,W-M-12,y);y+=6;
      for(const m of d.manips){const st=d.stations.find(x=>x.weekday===bk.weekday&&x.manipulation_code===m.code);
        doc.setFont('helvetica','bold');doc.text(m.code,M+16,y);doc.setFont('helvetica','normal');doc.text(m.title&&latin(m.title)?m.title:'.....................................................................................',M+30,y);
        doc.text(st?.room?String(st.room):'..................',W-M-28,y,{align:'center'});y+=1.8;doc.setLineWidth(0.2);doc.line(M+12,y,W-M-12,y);y+=6;}
      y+=4;doc.setFont('helvetica','bold');doc.setFontSize(10);doc.text('Repérage des groupes',W/2,y,{align:'center'});y+=2.5;
      const gw=(IW-24)/G;for(let g=0;g<G;g++){const c=GROUP_RGB[g%GROUP_RGB.length];band(M+12+g*gw,y,gw,7,c,'G'+(g+1),10,ink(c));}y+=15;
      doc.setFont('helvetica','italic');doc.setFontSize(9.5);doc.setTextColor(40);doc.text('Présence / absence à renseigner dans les cases. Manipulations prévues indiquées sous chaque date (à corriger à la main si besoin).',W/2,y,{align:'center'});
      /* Une page par classe et par groupe */
      names.forEach((cls,ci)=>{
        const sess=d.sessions.filter(s=>s.class_name===cls).sort((a,b)=>a.session_date.localeCompare(b.session_date));
        const cols=Math.max(sess.length+1,6);
        for(let g=1;g<=G;g++){
          const stu=d.members.filter(m=>m.class_name===cls&&m.group_no===g&&m.status==='actif').map(m=>d.studentById?.get(m.student_id)?.name||sname(m.student_id)).sort((a,b)=>a.localeCompare(b,'fr'));
          const nrows=Math.max(12,stu.length+2);
          page();let y=14;const X=M,Wt=IW;
          band(X,y,Wt,8,[243,239,200],`CAHIER DE PRÉSENCE — TP PHYSIQUE — ${day.toUpperCase()}`,12);y+=8;
          const gc=GROUP_RGB[(g-1)%GROUP_RGB.length];band(X,y,Wt*0.57,8,CLASS_RGB[ci%CLASS_RGB.length],`CLASSE ${cls}`,12);band(X+Wt*0.57,y,Wt*0.43,8,gc,`GROUPE G${g}`,12,ink(gc));y+=12;
          doc.setFont('helvetica','bold');doc.setFontSize(9.5);doc.setTextColor(30);doc.text(`Horaire : ${hours}  |  Effectif actuel : ${stu.length}/${nrows}`,W/2,y,{align:'center'});y+=2.5;
          const cN=10,cName=68,cd=(Wt-cN-cName)/cols,hh=13;
          const rh=Math.min(10,(186-y-hh)/nrows);
          doc.setFillColor(243,239,200);doc.setDrawColor(40);doc.setLineWidth(0.5);doc.rect(X,y,Wt,hh,'FD');
          doc.setLineWidth(0.25);doc.setFontSize(9);doc.text('N°',X+cN/2,y+hh/2+1.3,{align:'center'});doc.text('NOM ET PRÉNOM',X+cN+cName/2,y+hh/2+1.3,{align:'center'});
          doc.line(X+cN,y,X+cN,y+hh+nrows*rh);doc.line(X+cN+cName,y,X+cN+cName,y+hh+nrows*rh);
          for(let c=0;c<cols;c++){const x=X+cN+cName+c*cd;if(c)doc.line(x,y,x,y+hh+nrows*rh);const s=sess[c];
            if(s){const sl=s.slots.find(z=>z.group_no===g);doc.setFont('helvetica','bold');doc.setFontSize(9.5);doc.text(F(s.session_date),x+cd/2,y+5,{align:'center'});
              doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.text(`Manip. : ${sl?sl.manipulation_code:'..........'}`,x+cd/2,y+10,{align:'center'});}
            else{doc.setFont('helvetica','normal');doc.setFontSize(8.5);doc.text('...../...../.......',x+cd/2,y+5,{align:'center'});doc.text('Manip. : ..........',x+cd/2,y+10,{align:'center'});}}
          y+=hh;
          for(let r=0;r<nrows;r++){doc.setDrawColor(60);doc.line(X,y+(r+1)*rh,X+Wt,y+(r+1)*rh);doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text(String(r+1),X+cN/2,y+r*rh+rh/2+1.3,{align:'center'});
            if(stu[r]){doc.setFont('helvetica','normal');doc.setFontSize(stu[r].length>30?8:9.5);doc.text(stu[r].toUpperCase(),X+cN+2,y+r*rh+rh/2+1.3);}}
          doc.setLineWidth(0.5);doc.setDrawColor(40);doc.rect(X,y-hh,Wt,hh+nrows*rh);y+=nrows*rh+1;
          const exs=exList.filter(e=>onDay(e,bk.weekday)).map(exShort);
          if(exs.length){doc.setFont('helvetica','bold');doc.setFontSize(9);const lines=doc.splitTextToSize('Aucun TP : '+exs.join('  ·  '),Wt-6);const bh=2.5+lines.length*4;
            doc.setFillColor(243,239,200);doc.rect(X,y,Wt,bh,'F');doc.setTextColor(30);doc.text(lines,W/2,y+4.3,{align:'center'});y+=bh;}
          y+=6;doc.setFont('helvetica','italic');doc.setFontSize(10);doc.text('Signature enseignant : .....................................................',X,y);doc.setFont('helvetica','normal');doc.text('Observations : .....................................................',X+Wt*0.6,y);
          y+=7;doc.text('.........................................................................................................................................................................................',X,y);
        }
      });
    }
    doc.save(books.length===1?`Cahier_presence_${(DAY[books[0].weekday]||'').toLowerCase()}_${books[0].list.map(c=>c.class_name).join('_')}_S2.pdf`:'Cahiers_presence_TP_Physique_S2.pdf');
  }

  /* ----- Groupes : une classe à la fois, équilibre sur les étudiants présents (actifs) ----- */
  function viewGroups(v,d,admin){
    if(!d.members.length){
      v.innerHTML=`<div class="v33-empty"><i class="fas fa-people-group"></i><h4>Groupes S2 pas encore préparés</h4><p>La préparation reprend les groupes du S1, met de côté les étudiants absents à toutes les séances du S1 (réintégrables en un clic) et équilibre les groupes sur les étudiants présents.</p>${admin?'<button type="button" class="btn btn-primary v33-btn" id="v33-init"><i class="fas fa-wand-magic-sparkles"></i> Préparer les groupes S2</button>':''}</div>`;
      v.onclick=e=>{if(e.target.closest('#v33-init'))initGroups(d);};return;
    }
    const G=d.settings.group_count,cls=state.groupClass;
    const ms=d.members.filter(m=>m.class_name===cls),act=ms.filter(m=>m.status==='actif'),exc=ms.filter(m=>m.status==='exclu');
    const sizes=Array.from({length:G},(_,i)=>act.filter(m=>m.group_no===i+1).length);
    const gap=Math.max(...sizes)-Math.min(...sizes);
    v.innerHTML=`${chips(CLASSES.map(c=>[c,c,d.members.filter(m=>m.class_name===c&&m.status==='actif').length+' présents']),cls,'gc','Classe')}
      <section class="v33-card v33-summary">
        <div class="v33-balance ${gap<=1?'ok':'warn'}"><i class="fas ${gap<=1?'fa-scale-balanced':'fa-triangle-exclamation'}"></i><div><b>${gap<=1?'Groupes équilibrés':'Écart de '+gap+' étudiants'}</b><small>${act.length} présent(s) répartis · ${exc.length} mis de côté</small></div></div>
        <div class="v33-sizes">${sizes.map((n,i)=>`<div><span>G${i+1}</span><b>${n}</b></div>`).join('')}</div>
        ${admin?`<div class="v33-row tight"><button type="button" class="btn btn-primary v33-btn" data-bal ${gap<=1?'disabled':''}><i class="fas fa-scale-balanced"></i> Équilibrer</button><button type="button" class="btn v33-btn ghost" data-sync><i class="fas fa-user-plus"></i> Nouveaux</button></div>`:''}</section>
      <div class="v33-groups">${Array.from({length:G},(_,i)=>i+1).map(g=>{const list=act.filter(m=>m.group_no===g).sort((a,b)=>sname(a.student_id).localeCompare(sname(b.student_id)));
        return `<section class="v33-group" data-drop="${g}"><header><h4>G${g}</h4><span class="v33-count">${list.length}</span></header><ul>${list.map(m=>`<li ${admin?`draggable="true" data-drag="${m.student_id}"`:''}><span class="v33-sn">${esc(sname(m.student_id))}</span>${m.locked?'<i class="fas fa-lock v33-lk" title="Verrouillé dans ce groupe"></i>':''}${admin?`<button type="button" class="v33-icon" data-menu="${m.student_id}" aria-label="Actions pour ${esc(sname(m.student_id))}"><i class="fas fa-ellipsis-vertical"></i></button>`:''}</li>`).join('')||'<li class="v33-muted">—</li>'}</ul></section>`;}).join('')}</div>
      ${exc.length?`<section class="v33-card v33-excl"><h4><i class="fas fa-user-slash"></i> Mis de côté pour le S2 <span class="v33-count">${exc.length}</span></h4>${exc.map(m=>`<div class="v33-item"><div><b>${esc(sname(m.student_id))}</b><small>G${m.group_no} au S1 · ${esc(m.reason||'')}</small></div>${admin?`<button type="button" class="btn v33-btn ghost sm" data-in="${m.student_id}">Réintégrer</button>`:''}</div>`).join('')}</section>`:''}
      ${admin?`<div class="v33-foot"><span class="v33-muted"><i class="fas fa-hand-pointer"></i> Glissez un étudiant vers un autre groupe, ou touchez « ⋮ ».</span>${applyButton()}</div>`:''}`;
    const setMember=(id,patch,label,ev)=>{const m=d.members.find(x=>x.student_id===id);return mutate(label,()=>Object.assign(m,patch),async()=>{await q(client().from('v33_s2_group_members').update(Object.assign({updated_at:new Date().toISOString()},patch)).eq('student_id',id).select('student_id'));audit(ev,Object.assign({student:id},patch));});};
    v.onclick=e=>{
      const gc=e.target.closest('[data-gc]');if(gc){state.groupClass=gc.dataset.gc;return renderView();}
      if(!admin)return;
      const menu=e.target.closest('[data-menu]'),inn=e.target.closest('[data-in]');
      if(inn)return setMember(inn.dataset.in,{status:'actif',reason:null},'Étudiant réintégré','reintegrate_student');
      if(e.target.closest('[data-bal]'))return balance(d,cls);
      if(e.target.closest('[data-sync]'))return addNew(d);
      if(e.target.closest('#v33-apply'))return applyGroups(d);
      if(menu){const m=d.members.find(x=>x.student_id===menu.dataset.menu);
        modal(esc(sname(m.student_id)),`<label>Groupe<select id="v33-mg">${Array.from({length:G},(_,j)=>`<option value="${j+1}" ${j+1===m.group_no?'selected':''}>G${j+1} — ${sizes[j]} étudiant(s)</option>`).join('')}</select></label>
          <label class="v33-check"><input type="checkbox" id="v33-ml" ${m.locked?'checked':''}> Verrouiller dans ce groupe</label>
          <label class="v33-check"><input type="checkbox" id="v33-mx"> Mettre de côté pour le S2</label><input id="v33-mr" placeholder="Motif (si mis de côté)" maxlength="200">`,
          dlg=>{const g=Number(dlg.querySelector('#v33-mg').value),l=dlg.querySelector('#v33-ml').checked,x=dlg.querySelector('#v33-mx').checked;
            const patch={group_no:g,locked:l||(g!==m.group_no)};if(x)Object.assign(patch,{status:'exclu',reason:(dlg.querySelector('#v33-mr').value.trim()||'Mis de côté manuellement').slice(0,200)});
            setMember(m.student_id,patch,x?'Étudiant mis de côté':g!==m.group_no?`Déplacé en G${g}`:'Enregistré','edit_student');});}
    };
    if(!admin)return;
    let dragId=null;
    v.ondragstart=e=>{const li=e.target.closest?.('[data-drag]');if(!li)return;dragId=li.dataset.drag;li.classList.add('dragging');e.dataTransfer.effectAllowed='move';};
    v.ondragend=()=>{v.querySelectorAll('.dragging,.over').forEach(x=>x.classList.remove('dragging','over'));};
    v.ondragover=e=>{const z=e.target.closest?.('[data-drop]');if(z&&dragId){e.preventDefault();v.querySelectorAll('.over').forEach(x=>x!==z&&x.classList.remove('over'));z.classList.add('over');}};
    v.ondrop=e=>{const z=e.target.closest?.('[data-drop]');if(!z||!dragId)return;e.preventDefault();const g=Number(z.dataset.drop);const m=d.members.find(x=>x.student_id===dragId);dragId=null;
      if(m&&m.group_no!==g)setMember(m.student_id,{group_no:g,locked:true},`Déplacé en G${g} (verrouillé)`,'move_student');};
  }
  function applyButton(){
    const today=new Date().toISOString().slice(0,10);
    return today>'2026-12-11'?'<button type="button" class="btn v33-btn ghost" id="v33-apply"><i class="fas fa-file-import"></i> Appliquer aux listes de présence</button>':'<span class="v33-muted v33-note"><i class="fas fa-shield-halved"></i> Application aux listes de présence possible après le 11/12/2026</span>';
  }
  function balance(d,cls){
    const members=d.members.filter(m=>m.class_name===cls).map(m=>Object.assign({},m,{name:sname(m.student_id)}));
    const {moves}=C().balanceGroups(members,d.settings.group_count);
    if(!moves.length){toast('Déjà équilibré');return;}
    if(!confirm(`${moves.length} déplacement(s) dans ${cls} (présents seulement, verrouillés non déplacés) :\n\n${moves.map(m=>`${m.name} : G${m.from} → G${m.to}`).join('\n')}\n\nAppliquer ?`))return;
    mutate(`${cls} équilibrée (${moves.length} déplacement(s))`,()=>{for(const mv of moves)d.members.find(x=>x.student_id===mv.student_id).group_no=mv.to;},
      async()=>{for(const mv of moves)await q(client().from('v33_s2_group_members').update({group_no:mv.to,updated_at:new Date().toISOString()}).eq('student_id',mv.student_id).select('student_id'));audit('balance',{class:cls,moves});});
  }
  function addNew(d){
    const known=new Set(d.members.map(m=>m.student_id));const add=d.students.filter(s=>!known.has(s.id)&&s.group_no);
    if(!add.length){toast('Aucun nouvel étudiant');return;}
    const rows=add.map(s=>({student_id:s.id,class_name:s.class_name,group_no:s.group_no,s1_class_id:s.class_id,status:'actif',reason:null,locked:false}));
    mutate(add.length+' étudiant(s) ajouté(s)',()=>d.members.push(...rows),async()=>{await q(client().from('v33_s2_group_members').insert(rows).select('student_id'));audit('add_students',{n:rows.length});});
  }
  async function allS1Attendance(){
    const out=[];let from=0;
    for(;;){const data=await q(client().from('attendance').select('id,student_id,status,sessions!inner(session_date)').is('deleted_at',null).gte('sessions.session_date',S1_FROM).lte('sessions.session_date',S1_TO).order('id').range(from,from+999));
      out.push(...data);if(data.length<1000)break;from+=1000;}
    return out;
  }
  async function initGroups(d){
    state.busy++;
    try{
      const att=await allS1Attendance();
      const seen=new Map();for(const a of att){const s=seen.get(a.student_id)||{n:0,p:0};s.n++;if(a.status!=='absent')s.p++;seen.set(a.student_id,s);}
      let rows=d.students.filter(s=>s.group_no).map(s=>{const k=seen.get(s.id);const always=k&&k.n>=1&&k.p===0;
        return {student_id:s.id,class_name:s.class_name,group_no:s.group_no,s1_class_id:s.class_id,status:always?'exclu':'actif',reason:always?`Toujours absent au S1 (${k.n} séance${k.n>1?'s':''}) — réintégrable`:null,locked:false,name:s.name};});
      const {members}=C().balanceGroups(rows,d.settings.group_count);
      rows=members.map(({name,...r})=>r);
      await q(client().from('v33_s2_group_members').insert(rows).select('student_id'));
      await audit('init_groups',{n:rows.length,excluded:rows.filter(r=>r.status==='exclu').length,balanced:true});
      await load(true);toast('Groupes S2 préparés et équilibrés');
    }catch(e){toast('Échec : '+e.message,'err');}
    finally{state.busy--;}
    renderView();
  }
  async function applyGroups(d){
    const classes=await q(client().from('classes').select('id,name'));const byName=new Map(classes.map(c=>[c.name,c.id]));
    const moves=d.members.filter(m=>m.status==='actif').map(m=>({m,s:d.studentById.get(m.student_id),target:byName.get(`${m.class_name}-G${m.group_no}`)})).filter(x=>x.s&&x.target&&x.target!==x.s.class_id);
    if(!moves.length){toast('Les listes de présence correspondent déjà aux groupes S2');return;}
    if(!confirm(`${moves.length} étudiant(s) changeront de groupe dans les listes de présence. Les présences du S1 restent attachées à leurs séances. Continuer ?`))return;
    mutate('Groupes S2 appliqués aux listes de présence',()=>{for(const x of moves)x.s.class_id=x.target;},async()=>{for(const x of moves)await q(client().from('students').update({class_id:x.target}).eq('id',x.s.id).select('id'));audit('apply_groups',{moves:moves.map(x=>({student:x.s.id,to:x.target}))});});
  }

  /* ----- Enseignants : un jour à la fois, un enseignant par manipulation ----- */
  /* Récapitulatif « Intervenants par jour » (comme au S1) : une ligne par enseignant, une colonne par jour, sa manipulation. */
  function recapTable(d,days,profs,admin){
    const act=d.manips.filter(m=>m.active!==false);
    const codeOf=(t,w)=>(d.stations.find(s=>s.weekday===w&&s.teacher_id===t)||{}).manipulation_code||'';
    const rows=profs.filter(p=>admin||days.some(w=>codeOf(p.id,w)));
    const cell=(p,w)=>{const c=codeOf(p.id,w);return admin?`<select data-rt="${p.id}" data-rw="${w}" aria-label="${esc(p.full_name)} — ${C().DAY_LABEL[w]}"><option value="">—</option>${act.map(m=>`<option value="${m.code}" ${m.code===c?'selected':''}>${m.code}</option>`).join('')}</select>`:(c?`<span class="v33-m">${c}</span>`:'—');};
    const missing=days.flatMap(w=>act.filter(m=>!d.stations.some(s=>s.weekday===w&&s.manipulation_code===m.code&&s.teacher_id)).map(m=>`${C().DAY_LABEL[w]} ${m.code}`));
    return `<section class="v33-card v33-recap"><h4 class="v33-h">Intervenants par jour</h4><p class="v33-muted">Comme au S1 : la manipulation de chaque enseignant, jour par jour.${missing.length?` <b>Sans enseignant :</b> ${missing.join(', ')}.`:' Toutes les manipulations ont un enseignant.'}</p>
      <div class="table-responsive"><table class="table v33-recap-t"><thead><tr><th>Intervenant</th>${days.map(w=>`<th>${C().DAY_LABEL[w]}</th>`).join('')}</tr></thead><tbody>${rows.map(p=>`<tr><td>${esc(p.full_name)}</td>${days.map(w=>`<td>${cell(p,w)}</td>`).join('')}</tr>`).join('')||`<tr><td colspan="${days.length+1}">Aucun intervenant.</td></tr>`}</tbody></table></div>
      ${admin?'<div class="v33-row"><button type="button" class="btn btn-primary v33-btn" data-recap><i class="fas fa-floppy-disk"></i> Enregistrer les intervenants</button></div>':''}</section>`;
  }
  async function saveRecap(v,d,days){
    const act=d.manips.filter(m=>m.active!==false),rows=[],errs=[];
    for(const w of days){
      const pick=[...v.querySelectorAll(`select[data-rw="${w}"]`)].filter(x=>x.value).map(x=>({t:x.dataset.rt,c:x.value}));
      for(const m of act){const who=pick.filter(x=>x.c===m.code);if(who.length>1)errs.push(`${C().DAY_LABEL[w]} ${m.code} : ${who.length} enseignants`);
        const old=d.stations.find(s=>s.weekday===w&&s.manipulation_code===m.code)||{};
        rows.push({weekday:w,manipulation_code:m.code,teacher_id:who[0]?.t||null,room:old.room||null,updated_at:new Date().toISOString()});}
    }
    if(errs.length){toast('Une manipulation ne peut avoir qu\'un enseignant par jour : '+errs.join(' · '),'err');return;}
    return mutate('Intervenants enregistrés. Pensez à recalculer le planning.',()=>{d.stations=d.stations.filter(s=>!days.includes(s.weekday)).concat(rows);},async()=>{await q(client().from('v33_s2_stations').upsert(rows,{onConflict:'weekday,manipulation_code'}).select('weekday'));audit('stations',{recap:true});});
  }
  function viewTeachers(v,d,admin){
    const days=[...new Set(d.slots.filter(s=>s.active).map(s=>s.weekday))].sort();
    if(!days.includes(state.teacherDay))state.teacherDay=days[0];
    const w=state.teacherDay;const get=c=>d.stations.find(s=>s.weekday===w&&s.manipulation_code===c)||{};
    const profs=d.profiles.slice().sort((a,b)=>String(a.full_name).localeCompare(String(b.full_name)));
    v.innerHTML=`<p class="v33-lead"><i class="fas fa-circle-info"></i> Comme au S1 : chaque enseignant garde <b>sa manipulation</b> toute la journée, ce sont les groupes qui tournent.</p>
      ${chips(days.map(x=>[String(x),C().DAY_LABEL[x],d.slots.filter(s=>s.weekday===x).map(s=>s.class_name).join(' · ')]),String(w),'day','Jour')}
      <div class="v33-stations">${d.manips.map(m=>{const s=get(m.code);return `<section class="v33-card v33-station ${s.teacher_id?'set':''}"><header><span class="v33-m big">${m.code}</span><div><b>${esc(m.title||'Manipulation '+m.code.slice(1))}</b><small>Salle ${esc(s.room||m.room||'—')}</small></div></header>
        ${admin?`<select data-c="${m.code}" aria-label="Enseignant ${m.code}"><option value="">— Choisir l'enseignant —</option>${profs.map(p=>`<option value="${p.id}" ${p.id===s.teacher_id?'selected':''}>${esc(p.full_name)}</option>`).join('')}</select><input data-r="${m.code}" value="${esc(s.room||'')}" placeholder="Salle (par défaut ${esc(m.room||'—')})" maxlength="40" aria-label="Salle ${m.code}">`:`<p class="v33-who">${esc(tname(s.teacher_id))}</p>`}</section>`;}).join('')}</div>
      ${admin?`<div class="v33-row v33-sticky"><button type="button" class="btn btn-primary v33-btn" data-save><i class="fas fa-floppy-disk"></i> Enregistrer le ${C().DAY_LABEL[w].toLowerCase()}</button><button type="button" class="btn v33-btn ghost" data-s1><i class="fas fa-clone"></i> Reprendre ceux du S1</button></div>`:''}
      ${recapTable(d,days,profs,admin)}`;
    v.onchange=e=>{const sel=e.target.closest('select[data-c]');if(sel)sel.closest('.v33-station').classList.toggle('set',!!sel.value);};
    v.onclick=async e=>{
      const day=e.target.closest('[data-day]');if(day){state.teacherDay=Number(day.dataset.day);return renderView();}
      if(e.target.closest('[data-recap]'))return saveRecap(v,d,days);
      if(e.target.closest('[data-save]')){
        const rows=d.manips.map(m=>({weekday:w,manipulation_code:m.code,teacher_id:v.querySelector(`select[data-c="${m.code}"]`).value||null,room:v.querySelector(`input[data-r="${m.code}"]`).value.trim()||null,updated_at:new Date().toISOString()}));
        const ids=rows.map(r=>r.teacher_id).filter(Boolean);if(new Set(ids).size!==ids.length&&!confirm('Un même enseignant est sur deux manipulations le même jour. Continuer ?'))return;
        return mutate(`Enseignants du ${C().DAY_LABEL[w].toLowerCase()} enregistrés`,()=>{d.stations=d.stations.filter(s=>s.weekday!==w).concat(rows);},async()=>{await q(client().from('v33_s2_stations').upsert(rows,{onConflict:'weekday,manipulation_code'}).select('weekday'));audit('stations',{weekday:w});});
      }
      if(e.target.closest('[data-s1]')){
        try{const rows=await q(client().from('sessions').select('session_date,teacher_id,classes(name)').gte('session_date',S1_FROM).lte('session_date','2026-11-22').is('deleted_at',null));
          const sug=C().stationsFromS1(rows.map(r=>({class_name:r.classes?.name,session_date:r.session_date,teacher_id:r.teacher_id}))).filter(s=>s.weekday===w);
          for(const s of sug){const el=v.querySelector(`select[data-c="${s.manipulation_code}"]`);if(el){el.value=s.teacher_id;el.closest('.v33-station').classList.add('set','v33-flash');}}
          toast(sug.length?'Enseignants du S1 repris : vérifiez puis enregistrez':'Rien à reprendre pour ce jour');}catch(err){toast(err.message,'err');}
      }
    };
  }

  /* ----- Manipulations ----- */
  function viewManips(v,d,admin){
    v.innerHTML=`<p class="v33-lead"><i class="fas fa-circle-info"></i> Donnez un nom à chaque manipulation : il apparaît dans le planning et le PDF.</p><div class="v33-stations">${d.manips.map(m=>`<section class="v33-card v33-station"><header><span class="v33-m big">${m.code}</span><div><b>${esc(m.title||'Sans nom')}</b><small>Salle ${esc(m.room||'—')}</small></div></header>
      ${admin?`<input data-t="${m.code}" value="${esc(m.title||'')}" maxlength="120" placeholder="Nom (ex. Prisme)" aria-label="Nom ${m.code}"><input data-r="${m.code}" value="${esc(m.room||'')}" maxlength="40" placeholder="Salle par défaut" aria-label="Salle ${m.code}"><label class="v33-check"><input type="checkbox" data-a="${m.code}" ${m.active?'checked':''}> Active</label>`:''}</section>`).join('')}</div>
      ${admin?'<div class="v33-row v33-sticky"><button type="button" class="btn btn-primary v33-btn" data-save><i class="fas fa-floppy-disk"></i> Enregistrer</button></div>':''}`;
    v.onclick=e=>{if(!e.target.closest('[data-save]'))return;
      const rows=d.manips.map(m=>({code:m.code,title:v.querySelector(`[data-t="${m.code}"]`).value.trim()||null,room:v.querySelector(`[data-r="${m.code}"]`).value.trim()||null,active:v.querySelector(`[data-a="${m.code}"]`).checked,updated_at:new Date().toISOString()}));
      mutate('Manipulations enregistrées',()=>{d.manips=rows;},async()=>{await q(client().from('v33_s2_manipulations').upsert(rows,{onConflict:'code'}).select('code'));audit('manips',{});});};
  }

  /* ----- Dates exclues ----- */
  function viewDates(v,d,admin){
    const props=d.excluded.filter(x=>!x.validated);
    v.innerHTML=`<p class="v33-lead"><i class="fas fa-circle-info"></i> Les calendriers sont indicatifs : une date importée reste une <b>proposition</b> tant que vous ne l'avez pas validée. Seules les dates validées sont évitées.</p>
      ${admin?`<section class="v33-card"><form id="v33-dform" class="v33-form"><label>Du<input type="date" name="a" required min="2027-01-01"></label><label>Au (facultatif)<input type="date" name="b"></label><label class="v33-wide">Libellé<input name="l" placeholder="Ex. Vacances de printemps" required maxlength="160"></label><label>Type<select name="k">${Object.entries(KIND).map(([k,l])=>`<option value="${k}">${l}</option>`).join('')}</select></label><button class="btn btn-primary v33-btn"><i class="fas fa-plus"></i> Ajouter</button></form>
        <label class="btn v33-btn ghost v33-upload"><i class="fas fa-file-excel"></i> Importer un calendrier (.xlsx)<input type="file" id="v33-cal" accept=".xlsx,.xls" hidden></label></section>`:''}
      ${weekGrid(d,admin)}
      ${props.length?`<h4 class="v33-h">À valider <span class="v33-count">${props.length}</span></h4><div class="v33-list">${props.map(x=>dateItem(x,admin)).join('')}</div>`:''}
      <h4 class="v33-h">Dates exclues validées</h4><div class="v33-list">${d.excluded.filter(x=>x.validated).map(x=>dateItem(x,admin)).join('')||'<div class="v33-empty small"><p>Aucune pour l\'instant.</p></div>'}</div>`;
    if(!admin)return;
    v.onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);const a=f.get('a'),b=f.get('b')||a;if(b<a){toast('La fin précède le début','err');return;}
      const row={starts_on:a,ends_on:b,label:String(f.get('l')).trim(),kind:f.get('k'),source:'manuel',validated:true};const tmp=Object.assign({id:'tmp'+Date.now()},row);
      mutate('Date exclue ajoutée',()=>{d.excluded.push(tmp);d.excluded.sort((x,y)=>x.starts_on.localeCompare(y.starts_on));},async()=>{const [ins]=await q(client().from('v33_s2_excluded_dates').insert(row).select('id'));tmp.id=ins.id;audit('add_excluded',row);await afterExcluded();});};
    v.onclick=e=>{const wk=e.target.closest('[data-week]');if(wk){toggleWeek(d,wk.dataset.week);return;}
      const va=e.target.closest('[data-val]'),de=e.target.closest('[data-del]');
      if(va){const x=d.excluded.find(y=>y.id===va.dataset.val);const nv=!x.validated;mutate(nv?'Date validée':'Validation retirée',()=>{x.validated=nv;},async()=>{await q(client().from('v33_s2_excluded_dates').update({validated:nv}).eq('id',x.id).select('id'));audit('validate_excluded',{id:x.id,validated:nv});await afterExcluded();});}
      if(de&&confirm('Supprimer cette date ?')){const id=de.dataset.del;mutate('Date supprimée',()=>{d.excluded=d.excluded.filter(y=>y.id!==id);},async()=>{await q(client().from('v33_s2_excluded_dates').delete().eq('id',id).select('id'));audit('delete_excluded',{id});await afterExcluded();});}};
    v.onchange=e=>{if(e.target.id==='v33-cal')importCalendar(e.target.files[0]);};
  }
  /* Le serveur replanifie après chaque changement de date exclue validée : on recharge pour l'afficher. */
  async function afterExcluded(){
    if(!state.data?.sessions?.length)return;
    await load(true);toast('Planning recalculé automatiquement');renderView();
  }
  /* Semaines du S2 : un clic exclut toute la semaine (lundi → samedi). */
  function s2Weeks(d){
    const start=d.settings.start_date||'2027-01-11';const mon=C().addDays(start,1-C().weekdayOf(start));
    const end=d.settings.end_date||C().addDays(mon,7*17);const out=[];
    for(let w=mon,n=1;w<=end&&n<=30;w=C().addDays(w,7),n++)out.push({n,mon:w,sat:C().addDays(w,5)});
    return out;
  }
  function weekState(d,w){
    const full=d.excluded.find(x=>x.starts_on<=w.mon&&x.ends_on>=w.sat);
    const ex=C().excludedMap(d.excluded);let days=0;for(let i=0;i<6;i++)if(ex.has(C().addDays(w.mon,i)))days++;
    const prop=d.excluded.some(x=>!x.validated&&x.starts_on<=w.sat&&x.ends_on>=w.mon);
    return {full,days,prop};
  }
  function weekGrid(d,admin){
    const weeks=s2Weeks(d);
    return `<section class="v33-card"><h4 class="v33-h">Semaines du S2 <small class="v33-muted">${admin?'— touchez une semaine pour l\'exclure entièrement ou la rétablir':''}</small></h4>
      <div class="v33-weekgrid">${weeks.map(w=>{const st=weekState(d,w);const cls=st.full&&st.full.validated?'off':st.days?'part':st.prop?'prop':'';
        return `<button type="button" class="v33-wk ${cls}" ${admin?`data-week="${w.mon}"`:'disabled'} title="${st.full?esc(st.full.label):st.days?st.days+' jour(s) exclu(s)':'Semaine normale'}"><b>S${w.n}</b><small>${C().fmt(w.mon).slice(0,5)} – ${C().fmt(w.sat).slice(0,5)}</small><em>${st.full&&st.full.validated?'Exclue':st.days?st.days+' j exclu'+(st.days>1?'s':''):st.prop?'À valider':'TP'}</em></button>`;}).join('')}</div>
      <p class="v33-muted v33-legend"><span class="v33-wk-dot"></span> TP normal <span class="v33-wk-dot part"></span> jours exclus <span class="v33-wk-dot off"></span> semaine exclue</p></section>`;
  }
  function toggleWeek(d,mon){
    const w={mon,sat:C().addDays(mon,5)};const st=weekState(d,w);
    if(st.full&&st.full.starts_on===w.mon&&st.full.ends_on===w.sat){
      if(!confirm('Rétablir la semaine du '+C().fmt(w.mon)+' ? (« '+st.full.label+' »)'))return;
      const id=st.full.id;mutate('Semaine rétablie',()=>{d.excluded=d.excluded.filter(y=>y.id!==id);},async()=>{await q(client().from('v33_s2_excluded_dates').delete().eq('id',id).select('id'));audit('delete_excluded',{id,week:mon});await afterExcluded();});return;}
    if(st.full){toast('Cette semaine fait partie de « '+st.full.label+' » : modifiez-la dans la liste ci-dessous.','err');return;}
    const label=prompt('Exclure la semaine du '+C().fmt(w.mon)+' au '+C().fmt(w.sat)+'.\nLibellé :','Semaine exclue');
    if(label===null)return;const l=label.trim()||'Semaine exclue';
    const k=/vacance|cong/i.test(l)?'vacances':/\bds\b|devoir/i.test(l)?'ds':/examen/i.test(l)?'examen':/f[ée]ri/i.test(l)?'ferie':'autre';
    const row={starts_on:w.mon,ends_on:w.sat,label:l.slice(0,160),kind:k,source:'manuel',validated:true};const tmp=Object.assign({id:'tmp'+Date.now()},row);
    mutate('Semaine exclue',()=>{d.excluded.push(tmp);d.excluded.sort((x,y)=>x.starts_on.localeCompare(y.starts_on));},async()=>{const [ins]=await q(client().from('v33_s2_excluded_dates').insert(row).select('id'));tmp.id=ins.id;audit('add_excluded',Object.assign({week:true},row));await afterExcluded();});
  }
  function dateItem(x,admin){
    return `<div class="v33-item ${x.validated?'':'prop'}"><div class="v33-date"><b>${C().fmt(x.starts_on).slice(0,5)}</b><small>${x.ends_on!==x.starts_on?'→ '+C().fmt(x.ends_on).slice(0,5):C().fmt(x.starts_on).slice(6)}</small></div><div><b>${esc(x.label)}</b><small>${KIND[x.kind]||x.kind} · ${x.source==='calendrier'?'importée du calendrier':'saisie'}</small></div>
      ${admin?`<div class="v33-row tight"><button type="button" class="btn v33-btn ${x.validated?'ghost':'btn-primary'} sm" data-val="${x.id}">${x.validated?'Retirer':'Valider'}</button><button type="button" class="v33-icon" data-del="${x.id}" title="Supprimer"><i class="fas fa-trash"></i></button></div>`:''}</div>`;
  }
  async function importCalendar(file){
    if(!file)return;if(!root.XLSX){toast('Le lecteur Excel n\'est pas chargé','err');return;}
    const wb=root.XLSX.read(await file.arrayBuffer(),{cellDates:true});
    const props=[];const kw=/(vacance|f[ée]ri[ée]|cong[ée]|\bds\b|devoir|examen|rattrapage|f[êe]te|a[iï]d|mouled|ramadan|r[ée]volution|ind[ée]pendance|martyrs|travail)/i;
    const toIso=v=>{if(v instanceof Date&&!isNaN(v))return new Date(v.getTime()-v.getTimezoneOffset()*60000).toISOString().slice(0,10);
      const m=/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/.exec(String(v||''));if(!m)return null;const y=m[3].length===2?'20'+m[3]:m[3];return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;};
    for(const name of wb.SheetNames){
      for(const r of root.XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,raw:true,defval:null})){const text=r.filter(x=>typeof x==='string').join(' ');if(!kw.test(text))continue;
        const dates=r.map(toIso).filter(Boolean).concat((text.match(/\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}/g)||[]).map(toIso)).filter(x=>x>='2027-01-01'&&x<='2027-08-31').sort();
        if(!dates.length)continue;const k=/vacance|cong/i.test(text)?'vacances':/\bds\b|devoir/i.test(text)?'ds':/examen/i.test(text)?'examen':/f[ée]ri|f[êe]te|a[iï]d/i.test(text)?'ferie':'autre';
        props.push({starts_on:dates[0],ends_on:dates[dates.length-1],label:norm(text).slice(0,160),kind:k,source:'calendrier',validated:false});}
    }
    const uniq=[...new Map(props.map(p=>[p.starts_on+p.ends_on+p.label,p])).values()];
    if(!uniq.length){toast('Aucune date du S2 reconnue dans ce fichier','err');return;}
    if(!confirm(`${uniq.length} proposition(s) trouvée(s) dans « ${file.name} ». Elles seront ajoutées « à valider ». Continuer ?`))return;
    state.busy++;try{await q(client().from('v33_s2_excluded_dates').insert(uniq).select('id'));await audit('import_calendar',{file:file.name,n:uniq.length});await load(true);toast(uniq.length+' proposition(s) importée(s) — à valider');}catch(e){toast(e.message,'err');}finally{state.busy--;}
    renderView();
  }

  /* ----- Paramètres ----- */
  function viewSettings(v,d){
    const s=d.settings;
    v.innerHTML=`<section class="v33-card"><h4 class="v33-h">Semestre</h4><form id="v33-sform" class="v33-form"><label>Début du S2<input type="date" name="start" min="2027-01-11" value="${s.start_date}" required></label><label>Fin (facultatif)<input type="date" name="end" value="${s.end_date||''}"></label><label>Groupes<input type="number" name="g" min="1" max="12" value="${s.group_count}"></label><label>Manipulations<input type="number" name="m" min="1" max="9" value="${s.manip_count}"></label><button class="btn btn-primary v33-btn">Enregistrer</button></form></section>
      <section class="v33-card"><h4 class="v33-h">Créneaux des classes</h4><p class="v33-muted">Deux classes d'une même paire partagent le jour et les enseignants : « alternance » = une semaine chacune ; « bloc » = toutes les séances de la première puis de la seconde (comme le vendredi au S1).</p>
      <div class="v33-slots">${d.slots.map(c=>`<div class="v33-slot" data-c="${c.class_name}"><b>${c.class_name}</b><label>Jour<select name="w">${[1,2,3,4,5,6].map(w=>`<option value="${w}" ${w===c.weekday?'selected':''}>${C().DAY_LABEL[w]}</option>`).join('')}</select></label><label>Début<input type="time" name="st" value="${c.start_time.slice(0,5)}"></label><label>Fin<input type="time" name="et" value="${c.end_time.slice(0,5)}"></label><label>Paire<input name="p" value="${esc(c.pair_key)}"></label><label>Ordre<input type="number" name="o" min="1" max="9" value="${c.pair_order}"></label><label>Mode<select name="mo"><option value="alternance" ${c.mode==='alternance'?'selected':''}>alternance</option><option value="bloc" ${c.mode==='bloc'?'selected':''}>bloc</option></select></label><label class="v33-check"><input type="checkbox" name="a" ${c.active?'checked':''}> active</label></div>`).join('')}</div>
      <div class="v33-row"><button type="button" class="btn btn-primary v33-btn" data-slots>Enregistrer les créneaux</button></div></section>`;
    v.onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);const start=f.get('start');if(start<'2027-01-11'){toast('Le S2 ne peut pas commencer avant le 11/01/2027','err');return;}
      const patch={start_date:start,end_date:f.get('end')||null,group_count:Number(f.get('g')),manip_count:Number(f.get('m')),updated_at:new Date().toISOString()};
      mutate('Paramètres enregistrés',()=>Object.assign(d.settings,patch),async()=>{await q(client().from('v33_s2_settings').update(patch).eq('id',1).select('id'));audit('settings',patch);});};
    v.onclick=e=>{if(!e.target.closest('[data-slots]'))return;
      const rows=[...v.querySelectorAll('.v33-slot')].map(tr=>({class_name:tr.dataset.c,weekday:Number(tr.querySelector('[name=w]').value),start_time:tr.querySelector('[name=st]').value,end_time:tr.querySelector('[name=et]').value,pair_key:tr.querySelector('[name=p]').value.trim()||tr.dataset.c,pair_order:Number(tr.querySelector('[name=o]').value)||1,mode:tr.querySelector('[name=mo]').value,active:tr.querySelector('[name=a]').checked,updated_at:new Date().toISOString()}));
      if(rows.some(r=>r.end_time<=r.start_time)){toast('Une heure de fin précède le début','err');return;}
      mutate('Créneaux enregistrés',()=>{d.slots=rows.map(r=>Object.assign({},r,{start_time:r.start_time+':00',end_time:r.end_time+':00'}));},async()=>{await q(client().from('v33_s2_class_slots').upsert(rows,{onConflict:'class_name'}).select('class_name'));audit('class_slots',{});});};
  }

  /* ----- Versions et historique ----- */
  const ACTION={replace_plan:'Planning généré / recalculé',save_version:'Version enregistrée',restore_version:'Version restaurée',init_groups:'Groupes préparés',balance:'Groupes équilibrés',move_student:'Étudiant déplacé',edit_student:'Étudiant modifié',reintegrate_student:'Étudiant réintégré',stations:'Enseignants enregistrés',manips:'Manipulations enregistrées',settings:'Paramètres modifiés',class_slots:'Créneaux modifiés',add_excluded:'Date exclue ajoutée',validate_excluded:'Date validée',delete_excluded:'Date supprimée',import_calendar:'Calendrier importé',edit_slot:'Case modifiée',lock:'Séance verrouillée',unlock:'Séance déverrouillée',move:'Séance déplacée',add_students:'Étudiants ajoutés',apply_groups:'Groupes appliqués'};
  function viewVersions(v,d){
    v.innerHTML=`<div class="v33-cols2"><section class="v33-card"><h4 class="v33-h">Versions du planning</h4>${d.versions.map(x=>`<div class="v33-item"><div><b>${esc(x.label)}</b><small>${new Date(x.created_at).toLocaleString('fr-FR')}</small></div><button type="button" class="btn v33-btn ghost sm" data-rs="${x.id}">Restaurer</button></div>`).join('')||'<p class="v33-muted">Aucune version.</p>'}</section>
      <section class="v33-card"><h4 class="v33-h">Historique</h4>${d.audit.map(a=>`<div class="v33-item"><div><b>${esc(ACTION[a.action]||a.action)}</b><small>${new Date(a.created_at).toLocaleString('fr-FR')} · ${esc(short(tname(a.actor)))}</small></div></div>`).join('')||'<p class="v33-muted">Rien pour l\'instant.</p>'}</section></div>`;
    v.onclick=async e=>{const b=e.target.closest('[data-rs]');if(!b||!confirm('Restaurer cette version ? Le planning actuel est d\'abord sauvegardé.'))return;
      state.busy++;try{await q(client().rpc('v33_s2_save_version',{p_label:'Sauvegarde automatique avant restauration'}));await q(client().rpc('v33_s2_restore_version',{p_id:b.dataset.rs}));await load(true);toast('Version restaurée');}catch(err){toast(err.message,'err');}finally{state.busy--;}renderView();};
  }

  function init(){
    try{const s=root.localStorage.getItem(KEY);if(s==='S1'||s==='S2')state.sem=s;}catch(_){}
    mountTab();mountSwitch();setSemester(state.sem);
    root.addEventListener('v16:role-changed',()=>{state.data=null;if(isActive())render();});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
  root.V33Semestres={render,reload:()=>{state.data=null;return render();},exportPdf,exportBook,sync};
})(typeof window!=='undefined'?window:globalThis);
