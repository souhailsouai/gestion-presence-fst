/* V33 — Statistiques interactives par semestre (S1/S2 selon le sélecteur en haut de page).
   Une absence rattrapée compte « présent » (comme dans le reste de l'application) et reste
   visible comme rattrapage. Une case vide du cahier n'est jamais une absence. */
(function(root){
  'use strict';
  const client=()=>typeof supabaseClient!=='undefined'?supabaseClient:root.supabaseClient;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v??'').trim().replace(/\s+/g,' ');
  const fmt=d=>{const [y,m,j]=String(d).slice(0,10).split('-');return `${j}/${m}/${y}`;};
  const short=d=>fmt(d).slice(0,5);
  const CLASSES=['MPI1-A','MPI1-B','MPI1-C','MPI1-D','MPI1-E','PC1-A'];
  const reduce=()=>root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const st={rows:null,key:'',cls:'',group:'',q:'',sort:'a',all:false};

  function mount(){
    if(document.getElementById('statistiques'))return;
    const main=document.getElementById('fst-main')||document.querySelector('.content');if(!main)return;
    const tab=document.createElement('div');tab.id='statistiques';tab.className='tab-content';
    tab.innerHTML='<h2><i class="fas fa-chart-column"></i> Statistiques</h2><div id="v33-stats" class="v33s"></div>';
    main.appendChild(tab);
    new MutationObserver(()=>{if(active())render();}).observe(tab,{attributes:true,attributeFilter:['class']});
    root.addEventListener('v33:semester',()=>{st.rows=null;st.cls='';st.group='';if(active())render();});
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
  const tone=r=>r>=85?'good':r>=70?'mid':'bad';

  /* ----- Graphiques (SVG, sans bibliothèque) ----- */
  function donut(t){
    const parts=[['Présents',t.p-t.mk,'var(--v33-good)'],['Rattrapés',t.mk,'var(--brand-yellow)'],['Justifiés',t.j,'#8aa4c8'],['Absents',t.a,'var(--brand-red)']].filter(x=>x[1]>0);
    const R=52,C=2*Math.PI*R;let off=0;
    const arcs=parts.map(([l,v,c])=>{const len=t.t?C*v/t.t:0;const s=`<circle r="${R}" cx="70" cy="70" fill="none" stroke="${c}" stroke-width="18" stroke-dasharray="${len} ${C-len}" stroke-dashoffset="${-off}" class="v33s-arc"><title>${l} : ${v}</title></circle>`;off+=len;return s;}).join('');
    return `<div class="v33s-donut"><svg viewBox="0 0 140 140" role="img" aria-label="Répartition des présences"><g transform="rotate(-90 70 70)">${arcs}</g>
      <text x="70" y="66" text-anchor="middle" class="v33s-donut-v">${t.rate} %</text><text x="70" y="86" text-anchor="middle" class="v33s-donut-l">présence</text></svg>
      <ul class="v33s-legend">${parts.map(([l,v,c])=>`<li><i style="background:${c}"></i>${l}<b>${v}</b></li>`).join('')}</ul></div>`;
  }
  function trend(list,avail){
    if(!list.length)return '<p class="v33-muted">Aucune date.</p>';
    const W=Math.max(300,list.length*58,Math.floor(avail||0)),H=180,pl=34,pr=14,pt=14,pb=28;
    const x=i=>pl+(list.length===1?(W-pl-pr)/2:i*(W-pl-pr)/(list.length-1));
    const y=v=>pt+(100-v)*(H-pt-pb)/100;
    const pts=list.map((d,i)=>[x(i),y(d.rate)]);
    const line=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
    const area=line+` L${pts[pts.length-1][0].toFixed(1)} ${H-pb} L${pts[0][0].toFixed(1)} ${H-pb} Z`;
    const grid=[0,25,50,75,100].map(v=>`<line x1="${pl}" x2="${W-pr}" y1="${y(v)}" y2="${y(v)}" class="v33s-grid"/><text x="${pl-6}" y="${y(v)+3}" text-anchor="end" class="v33s-axis">${v}</text>`).join('');
    return `<div class="v33-scroll"><svg class="v33s-trend" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Taux de présence par date">
      <defs><linearGradient id="v33s-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--brand-navy)" stop-opacity=".28"/><stop offset="1" stop-color="var(--brand-navy)" stop-opacity="0"/></linearGradient></defs>
      ${grid}<path d="${area}" fill="url(#v33s-grad)" class="v33s-area"/><path d="${line}" class="v33s-line" pathLength="1"/>
      ${list.map((d,i)=>`<g class="v33s-pt"><circle cx="${pts[i][0]}" cy="${pts[i][1]}" r="5" class="${tone(d.rate)}"><title>${fmt(d.key)} : ${d.rate} % (${d.p}/${d.t}) · ${d.a} absence(s)</title></circle><text x="${pts[i][0]}" y="${H-8}" text-anchor="middle" class="v33s-axis">${short(d.key)}</text><text x="${pts[i][0]}" y="${pts[i][1]-10}" text-anchor="middle" class="v33s-val">${Math.round(d.rate)}</text></g>`).join('')}
    </svg></div>`;
  }
  function heat(rows){
    const groups=[...new Set(rows.map(r=>r.group))].sort();const dates=[...new Set(rows.map(r=>r.date))].sort();
    if(groups.length<2||!dates.length)return '';
    const m=new Map(agg(rows,r=>r.group+'|'+r.date).map(x=>[x.key,x]));
    return `<section class="v33s-card v33s-wide"><header><h3>Carte de présence</h3><span class="v33-muted">groupe × date — survolez une case</span></header><div class="v33-scroll"><table class="v33s-heat"><thead><tr><th></th>${dates.map(d=>`<th>${short(d)}</th>`).join('')}</tr></thead><tbody>
      ${groups.map(g=>`<tr><th>${esc(g)}</th>${dates.map(d=>{const x=m.get(g+'|'+d);return x?`<td class="h-${tone(x.rate)}" style="--r:${x.rate}" title="${esc(g)} · ${fmt(d)} : ${x.rate} % (${x.p}/${x.t})">${Math.round(x.rate)}</td>`:'<td class="h-none" title="Pas de séance">·</td>';}).join('')}</tr>`).join('')}</tbody></table></div></section>`;
  }

  /* ----- Rendu ----- */
  async function render(){
    const box=document.getElementById('v33-stats');if(!box)return;
    if(!st.rows)box.innerHTML=`<div class="v33s-skel"><i></i><i></i><i></i><i></i></div>`;
    let rows;try{rows=await load();}catch(e){box.innerHTML=`<p class="v33-warn">Impossible de charger les statistiques : ${esc(e.message)}</p>`;return;}
    const r=range();
    const classes=CLASSES.filter(c=>rows.some(x=>x.class_name===c));
    const head=`<div class="v33s-head"><div><span class="v33s-sem">${sem()}</span><span class="v33-muted">${fmt(r.from)} → ${fmt(r.to)}</span></div>
      <div class="v33s-filters" role="toolbar" aria-label="Filtrer par classe"><button type="button" class="v33s-chip ${!st.cls?'on':''}" data-cls="">Toutes</button>${classes.map(c=>`<button type="button" class="v33s-chip ${st.cls===c?'on':''}" data-cls="${c}">${c}</button>`).join('')}</div></div>`;
    if(!rows.length){box.innerHTML=head+`<div class="v33s-empty"><i class="fas fa-chart-line"></i><p>Aucune présence enregistrée pour ce semestre.</p></div>`;bind(box);return;}
    let f=rows;if(st.cls)f=f.filter(x=>x.class_name===st.cls);if(st.group)f=f.filter(x=>x.group===st.group);
    const tot=agg(f,()=>'all')[0]||{t:0,p:0,a:0,j:0,mk:0,rate:0};
    const byClass=agg(rows,x=>x.class_name).sort((a,b)=>a.key.localeCompare(b.key));
    const byGroup=st.cls?agg(rows.filter(x=>x.class_name===st.cls),x=>x.group).sort((a,b)=>a.key.localeCompare(b.key)):[];
    const byDate=agg(f,x=>x.date).sort((a,b)=>a.key.localeCompare(b.key));
    const students=agg(f,x=>x.student_id+'|'+x.student+'|'+x.group).map(s=>{const [,n,g]=s.key.split('|');return Object.assign(s,{name:n,grp:g});});
    const always=students.filter(s=>s.t>=2&&s.p===0&&s.j===0);
    const sessions=new Set(f.map(x=>x.group+x.date)).size;
    const kpi=(icon,val,label,cls,suffix='')=>`<div class="v33s-kpi ${cls||''}"><span class="v33s-ico"><i class="fas ${icon}"></i></span><div><b data-count="${val}" data-suffix="${suffix}">${val}${suffix}</b><small>${label}</small></div></div>`;
    const bars=(list,sel,attr)=>`<div class="v33s-bars">${list.map(x=>`<button type="button" class="v33s-bar ${sel===x.key?'on':''}" data-${attr}="${esc(x.key)}" aria-pressed="${sel===x.key}"><span class="v33s-bl">${esc(x.key)}</span><span class="v33s-track"><span class="v33s-fill ${tone(x.rate)}" style="--w:${x.rate}%"></span></span><span class="v33s-bv">${x.rate} %</span><small>${x.p}/${x.t} · ${x.a} abs.</small></button>`).join('')}</div>`;
    box.innerHTML=head+`
      ${st.group?`<p class="v33s-crumb">Groupe <b>${esc(st.group)}</b> <button type="button" class="v33s-chip" data-grp="${esc(st.group)}">✕ retirer</button></p>`:''}
      <div class="v33s-kpis">
        ${kpi('fa-calendar-check',sessions,'séances de groupe')}
        ${kpi('fa-list-check',tot.t,'présences saisies')}
        ${kpi('fa-user-check',tot.rate,'taux de présence','good',' %')}
        ${kpi('fa-user-xmark',tot.a,'absences','bad')}
        ${kpi('fa-file-medical',tot.j,'justifiées')}
        ${kpi('fa-rotate',tot.mk,'rattrapages','warn')}
      </div>
      <div class="v33s-grid">
        <section class="v33s-card"><header><h3>Répartition</h3></header>${donut(tot)}</section>
        <section class="v33s-card"><header><h3>${st.cls?'Groupes de '+esc(st.cls):'Par classe'}</h3><span class="v33-muted">cliquez pour filtrer</span></header>${st.cls?bars(byGroup,st.group,'grp'):bars(byClass,st.cls,'cls')}</section>
      </div>
      <section class="v33s-card v33s-wide"><header><h3>Évolution par date</h3><span class="v33-muted">taux de présence (%)</span></header>${trend(byDate,(box.clientWidth||900)-36)}</section>
      ${st.group?'':heat(f)}
      <div class="v33s-grid">
        <section class="v33s-card"><header><h3>Absents à toutes les séances <span class="v33s-badge">${always.length}</span></h3></header>${always.length?`<ul class="v33s-people">${always.map(s=>`<li><span class="v33s-av">${esc(s.name.slice(0,1))}</span><div><b>${esc(s.name)}</b><small>${esc(s.grp)} · ${s.t} séance(s)</small></div></li>`).join('')}</ul>`:'<p class="v33-muted">Aucun.</p>'}</section>
        <section class="v33s-card"><header><h3>Étudiants</h3><input type="search" id="v33s-q" placeholder="Rechercher un nom…" value="${esc(st.q)}" aria-label="Rechercher un étudiant"></header><div id="v33s-table"></div></section>
      </div>
      <p class="v33-muted v33s-note"><i class="fas fa-circle-info"></i> Une case vide du cahier n'est jamais comptée comme absence. Une absence rattrapée compte comme présence et apparaît dans « rattrapages ».</p>`;
    renderTable(students);
    bind(box,students);
    animate(box);
  }
  function renderTable(students){
    const el=document.getElementById('v33s-table');if(!el)return;
    const q=norm(st.q).toLowerCase();
    let list=students.filter(s=>!q||s.name.toLowerCase().includes(q));
    const by={a:(x,y)=>y.a-x.a||x.name.localeCompare(y.name),n:(x,y)=>x.name.localeCompare(y.name),r:(x,y)=>x.rate-y.rate||x.name.localeCompare(y.name)}[st.sort];
    list=list.sort(by);const total=list.length;if(!st.all&&!q)list=list.slice(0,12);
    const th=(k,l)=>`<th><button type="button" data-sort="${k}" class="${st.sort===k?'on':''}">${l}${st.sort===k?' ▾':''}</button></th>`;
    el.innerHTML=list.length?`<div class="v33-scroll"><table class="v33s-table"><thead><tr>${th('n','Étudiant')}<th>Groupe</th>${th('a','Abs.')}${th('r','Présence')}<th>Ratt.</th></tr></thead><tbody>${list.map(s=>`<tr><td>${esc(s.name)}</td><td>${esc(s.grp)}</td><td><span class="v33s-pill ${s.a?'bad':''}">${s.a}</span></td><td><span class="v33s-mini"><i class="${tone(s.rate)}" style="width:${s.rate}%"></i></span>${Math.round(s.rate)} %</td><td>${s.mk||''}</td></tr>`).join('')}</tbody></table></div>${!q&&total>12?`<button type="button" class="v33s-chip v33s-more" data-all>${st.all?'Réduire':'Afficher les '+total+' étudiants'}</button>`:''}`:'<p class="v33-muted">Aucun étudiant.</p>';
  }
  function bind(box,students){
    box.onclick=e=>{
      const s=e.target.closest('[data-sort]');if(s){st.sort=s.dataset.sort;renderTable(students);return;}
      if(e.target.closest('[data-all]')){st.all=!st.all;renderTable(students);return;}
      const c=e.target.closest('[data-cls]'),g=e.target.closest('[data-grp]');
      if(c){st.cls=c.dataset.cls===st.cls?'':c.dataset.cls;st.group='';}
      else if(g){st.group=st.group===g.dataset.grp?'':g.dataset.grp;}
      else return;
      render();
    };
    const q=box.querySelector('#v33s-q');
    if(q)q.oninput=()=>{st.q=q.value;renderTable(students);};
  }
  /* Animations douces (désactivées si l'utilisateur préfère moins de mouvement). */
  function animate(box){
    box.classList.remove('v33s-in');void box.offsetWidth;box.classList.add('v33s-in');
    if(reduce())return;
    box.querySelectorAll('[data-count]').forEach(el=>{
      const end=Number(el.dataset.count),suf=el.dataset.suffix||'',dec=String(end).includes('.')?1:0,t0=performance.now(),D=650;
      const step=t=>{const k=Math.min(1,(t-t0)/D),v=end*(1-Math.pow(1-k,3));el.textContent=v.toFixed(dec)+suf;if(k<1)requestAnimationFrame(step);};
      requestAnimationFrame(step);
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
  root.V33Stats={render,reload(){st.rows=null;return render();}};
})(typeof window!=='undefined'?window:globalThis);
