/* V33 — Statistiques interactives par semestre (S1/S2 selon le sélecteur en haut de page).
   Une absence rattrapée est comptée « présent » (comme dans le reste de l'application),
   et reste visible dans la colonne « Rattrapages ». */
(function(root){
  'use strict';
  const client=()=>typeof supabaseClient!=='undefined'?supabaseClient:root.supabaseClient;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v??'').trim().replace(/\s+/g,' ');
  const fmt=d=>{const [y,m,j]=String(d).slice(0,10).split('-');return `${j}/${m}/${y}`;};
  const CLASSES=['MPI1-A','MPI1-B','MPI1-C','MPI1-D','MPI1-E','PC1-A'];
  const st={rows:null,key:'',cls:'',group:'',student:''};

  function mount(){
    if(document.getElementById('statistiques'))return;
    const main=document.getElementById('fst-main')||document.querySelector('.content');if(!main)return;
    const tab=document.createElement('div');tab.id='statistiques';tab.className='tab-content';
    tab.innerHTML='<h2><i class="fas fa-chart-column"></i> Statistiques</h2><div id="v33-stats"></div>';
    main.appendChild(tab);
    new MutationObserver(()=>{if(active())render();}).observe(tab,{attributes:true,attributeFilter:['class']});
    root.addEventListener('v33:semester',()=>{st.rows=null;if(active())render();});
  }
  const active=()=>document.getElementById('statistiques')?.classList.contains('active');
  const range=()=>root.V33Semester?root.V33Semester.range():{from:'2026-09-01',to:'2026-12-31'};
  const sem=()=>root.V33Semester?root.V33Semester.get():'S1';

  async function load(){
    const r=range();const key=r.from+r.to;
    if(st.rows&&st.key===key)return st.rows;
    const rows=[];let from=0;
    for(;;){
      const {data,error}=await client().from('attendance').select('status,makeup_date,student_id,students(last_name,first_name),sessions!inner(session_date,deleted_at,classes(name))')
        .gte('sessions.session_date',r.from).lte('sessions.session_date',r.to).is('deleted_at',null).range(from,from+999);
      if(error)throw error;rows.push(...data);if(data.length<1000)break;from+=1000;
    }
    st.rows=rows.filter(a=>!a.sessions.deleted_at).map(a=>{const g=a.sessions.classes?.name||'';return {status:a.status,makeup:a.makeup_date,date:a.sessions.session_date,group:g,class_name:g.replace(/-G\d+$/,''),student_id:a.student_id,student:norm((a.students?.last_name||'')+' '+(a.students?.first_name||''))};}).filter(a=>CLASSES.includes(a.class_name));
    st.key=key;return st.rows;
  }
  function agg(rows,keyFn){
    const m=new Map();
    for(const r of rows){const k=keyFn(r);if(!m.has(k))m.set(k,{key:k,t:0,p:0,a:0,j:0,mk:0});const x=m.get(k);x.t++;if(r.status==='absent')x.a++;else if(r.status==='justifie')x.j++;else x.p++;if(r.makeup)x.mk++;}
    return [...m.values()].map(x=>Object.assign(x,{rate:x.t?Math.round(1000*x.p/x.t)/10:0}));
  }
  function bars(list,sel,attr){
    const max=100;
    return `<div class="v33-bars">${list.map(x=>`<button type="button" class="v33-bar ${sel===x.key?'on':''}" data-${attr}="${esc(x.key)}" aria-pressed="${sel===x.key}" title="${esc(x.key)} : ${x.rate} % de présence (${x.p}/${x.t})">
      <span class="v33-bar-label">${esc(x.key)}</span><span class="v33-bar-track"><span class="v33-bar-fill" style="width:${Math.max(2,x.rate/max*100)}%"></span></span><span class="v33-bar-val">${x.rate} %</span></button>`).join('')}</div>`;
  }

  async function render(){
    const box=document.getElementById('v33-stats');if(!box)return;
    box.innerHTML='<p class="v33-muted">Chargement…</p>';
    let rows;try{rows=await load();}catch(e){box.innerHTML=`<p class="v33-warn">Impossible de charger les statistiques : ${esc(e.message)}</p>`;return;}
    const r=range();
    if(!rows.length){box.innerHTML=`<div class="v33-banner"><strong>${sem()}</strong> · ${fmt(r.from)} → ${fmt(r.to)}</div><p class="v33-muted">Aucune présence enregistrée pour ce semestre.</p>`;return;}
    let f=rows;
    if(st.cls)f=f.filter(x=>x.class_name===st.cls);
    if(st.group)f=f.filter(x=>x.group===st.group);
    const tot=agg(f,()=>'all')[0]||{t:0,p:0,a:0,j:0,mk:0,rate:0};
    const byClass=agg(rows,x=>x.class_name).sort((a,b)=>a.key.localeCompare(b.key));
    const byGroup=st.cls?agg(rows.filter(x=>x.class_name===st.cls),x=>x.group).sort((a,b)=>a.key.localeCompare(b.key)):[];
    const byDate=agg(f,x=>x.date).sort((a,b)=>a.key.localeCompare(b.key));
    const students=agg(f,x=>x.student_id+'|'+x.student+'|'+x.group);
    const always=students.filter(s=>s.t>=2&&s.p===0&&s.j===0);
    const worst=students.filter(s=>s.a>0).sort((a,b)=>b.a-a.a||a.key.localeCompare(b.key)).slice(0,25);
    const sessions=new Set(f.map(x=>x.group+x.date)).size;
    box.innerHTML=`<div class="v33-banner"><strong>${sem()}</strong> · ${fmt(r.from)} → ${fmt(r.to)}${st.cls?` · <strong>${esc(st.cls)}</strong>`:''}${st.group?` · ${esc(st.group)}`:''} ${st.cls||st.group?'<button type="button" class="btn btn-sm" data-reset>Tout afficher</button>':''}</div>
      <div class="v33-kpis">
        <div class="v33-kpi"><span>${sessions}</span>séances de groupe</div>
        <div class="v33-kpi"><span>${tot.t}</span>présences saisies</div>
        <div class="v33-kpi good"><span>${tot.rate} %</span>taux de présence</div>
        <div class="v33-kpi bad"><span>${tot.a}</span>absences</div>
        <div class="v33-kpi"><span>${tot.j}</span>justifiées</div>
        <div class="v33-kpi"><span>${tot.mk}</span>rattrapages</div>
      </div>
      <div class="v33-grid2">
        <section class="v33-card"><h3>Par classe <small>(cliquez pour filtrer)</small></h3>${bars(byClass,st.cls,'cls')}</section>
        <section class="v33-card"><h3>${st.cls?'Par groupe — '+esc(st.cls):'Par groupe'}</h3>${st.cls?bars(byGroup,st.group,'grp'):'<p class="v33-muted">Choisissez une classe.</p>'}</section>
      </div>
      <section class="v33-card"><h3>Par date</h3><div class="v33-cols">${byDate.map(x=>`<div class="v33-col" title="${fmt(x.key)} : ${x.rate} % (${x.p}/${x.t}), ${x.a} absence(s)"><span class="v33-col-fill" style="height:${Math.max(3,x.rate)}%"></span><small>${fmt(x.key).slice(0,5)}</small></div>`).join('')}</div></section>
      <div class="v33-grid2">
        <section class="v33-card"><h3>Absents à toutes les séances <small>(${always.length})</small></h3>${always.length?`<ul>${always.map(s=>{const [,n,g]=s.key.split('|');return `<li>${esc(n)} <small>${esc(g)} · ${s.t} séance(s)</small></li>`;}).join('')}</ul>`:'<p class="v33-muted">Aucun.</p>'}</section>
        <section class="v33-card"><h3>Le plus d'absences</h3>${worst.length?`<table class="v33-table"><thead><tr><th>Étudiant</th><th>Groupe</th><th>Abs.</th><th>Prés.</th><th>Ratt.</th></tr></thead><tbody>${worst.map(s=>{const [,n,g]=s.key.split('|');return `<tr><td>${esc(n)}</td><td>${esc(g)}</td><td>${s.a}</td><td>${s.p}</td><td>${s.mk||''}</td></tr>`;}).join('')}</tbody></table>`:'<p class="v33-muted">Aucune absence.</p>'}</section>
      </div>
      <p class="v33-muted">Une case vide du cahier n'est jamais comptée comme absence. Une absence rattrapée compte comme présence et apparaît dans « rattrapages ».</p>`;
    box.onclick=e=>{const c=e.target.closest('[data-cls]'),g=e.target.closest('[data-grp]');
      if(e.target.closest('[data-reset]')){st.cls='';st.group='';}
      else if(c){st.cls=st.cls===c.dataset.cls?'':c.dataset.cls;st.group='';}
      else if(g){st.group=st.group===g.dataset.grp?'':g.dataset.grp;}
      else return;render();};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
  root.V33Stats={render,reload(){st.rows=null;return render();}};
})(typeof window!=='undefined'?window:globalThis);
