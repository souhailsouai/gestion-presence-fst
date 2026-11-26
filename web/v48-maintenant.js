/* V48 — Tableau de bord style One UI 9 :
   - carte « Maintenant » (séance en cours ou prochaine du jour, avec « Faire l'appel ») ;
   - « À rattraper » : étudiants avec 2 absences non rattrapées ou plus, créneau S2 proposé ;
   - recherche d'un étudiant (groupe, présences, notes, rattrapages).
   Les données viennent de la base avec les droits de la personne connectée (RLS). */
(function(root){
  'use strict';
  if(root.V48Maintenant)return;
  const S2_START='2027-01-11';
  const pad=n=>String(n).padStart(2,'0');
  const todayIso=()=>{if(root.V48_TODAY)return root.V48_TODAY;const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
  const nowHm=()=>{if(root.V48_NOW)return root.V48_NOW;const d=new Date();return `${pad(d.getHours())}:${pad(d.getMinutes())}`;};
  const hm=t=>String(t||'').slice(0,5);
  const fr=d=>d?`${String(d).slice(8,10)}/${String(d).slice(5,7)}`:'';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const DAYS=['dim.','lun.','mar.','mer.','jeu.','ven.','sam.'];
  const day=d=>DAYS[new Date(d+'T12:00:00').getDay()]||'';
  function me(){try{return typeof currentTeacher!=='undefined'?currentTeacher:root.currentTeacher;}catch(_){return root.currentTeacher||null;}}
  const client=()=>root.supabaseClient||null;

  /* ---------- Fonctions pures (testées sous Node) ---------- */
  /** Carte contextuelle : avant/pendant une séance → « Faire l'appel » ; après → appel oublié, ou notes à saisir. */
  function pickNow(items,now){
    const all=(items||[]).slice().sort((a,b)=>hm(a.start).localeCompare(hm(b.start)));
    const upcoming=all.filter(x=>hm(x.end)>=now),ended=all.filter(x=>hm(x.end)<now);
    const next=upcoming.find(x=>!x.done)||upcoming[0]||[...ended].reverse().find(x=>!x.done)||[...ended].reverse().find(x=>x.needGrades);
    if(!next)return null;
    const finished=hm(next.end)<now,running=!finished&&now>=hm(next.start);
    const [h1,m1]=now.split(':').map(Number),[h2,m2]=hm(next.start).split(':').map(Number);
    const mins=(h2*60+m2)-(h1*60+m1);
    const action=!next.done?'Faire l\u2019appel':finished&&next.needGrades?'Saisir les notes':'Voir l\u2019appel';
    return {...next,finished,action,when:finished?'terminée':running?'en cours':mins<120?`dans ${mins} min`:`à ${hm(next.start).replace(':','h')}`};
  }
  /** Étudiants avec au moins `min` absences non rattrapées ; créneau proposé = même manipulation, autre groupe, à partir d'aujourd'hui. */
  function makeupRows(absences,plan,today,min=2){
    const by=new Map();
    for(const a of absences||[]){if(!by.has(a.student_id))by.set(a.student_id,[]);by.get(a.student_id).push(a);}
    const out=[];
    for(const [sid,list] of by){
      if(list.length<min)continue;
      list.sort((x,y)=>x.date.localeCompare(y.date));
      const cls=list[list.length-1].class_name||'';const m=/^(.*)-G(\d+)$/.exec(cls);const base=m?m[1]:cls,g=m?Number(m[2]):null;
      const missed=list.map(a=>{const am=/^(.*)-G(\d+)$/.exec(a.class_name||'');const p=(plan||[]).find(s=>s.class_name===(am?am[1]:a.class_name)&&s.session_date===a.date);
        const slot=p&&am?(p.slots||[]).find(x=>x.group_no===Number(am[2])):null;return {date:a.date,manip:slot?.manipulation_code||null};});
      let suggestion=null;
      for(const {manip} of missed){if(!manip)continue;
        const p=(plan||[]).filter(s=>s.class_name===base&&s.session_date>=today).sort((x,y)=>x.session_date.localeCompare(y.session_date))
          .find(s=>(s.slots||[]).some(x=>x.manipulation_code===manip&&x.group_no!==g));
        if(p){const sl=p.slots.find(x=>x.manipulation_code===manip&&x.group_no!==g);suggestion=`${day(p.session_date)} ${fr(p.session_date)} · ${hm(p.start_time)} · G${sl.group_no} — ${manip}${sl.room?' · Salle '+sl.room:''}`;break;}}
      out.push({student_id:sid,name:list[0].name,class_name:cls,missed,suggestion});
    }
    return out.sort((a,b)=>b.missed.length-a.missed.length||a.name.localeCompare(b.name,'fr'));
  }
  /** Texte de recherche sûr pour un filtre PostgREST (lettres, chiffres, espaces, tirets). */
  const safeQuery=q=>String(q||'').normalize('NFC').replace(/[^\p{L}\p{N}\s'-]/gu,' ').replace(/\s+/g,' ').trim().slice(0,40);

  /* ---------- Données ---------- */
  async function loadNow(){
    const c=client(),t=me();if(!c||!t)return null;
    const day0=todayIso(),uid=t.id;
    const [s2,s1,ses,titles]=await Promise.all([
      c.from('v33_s2_slots').select('id,group_no,manipulation_code,room,attendance_session_id,space_id,session:v33_s2_sessions!inner(session_date,start_time,end_time,class_name)').eq('teacher_id',uid).eq('session.session_date',day0),
      c.from('session_plans').select('id,session_id,start_time,end_time,manipulation,room,status,classes(name)').eq('teacher_id',uid).eq('plan_date',day0).is('deleted_at',null),
      c.from('sessions').select('id,start_time,end_time,classes(name),attendance(count),ng:attendance(count)').eq('teacher_id',uid).eq('session_date',day0).is('deleted_at',null).is('ng.grade',null).in('ng.status',['present','retard']),
      c.from('v33_s2_manipulations').select('space_id,code,title')]);
    const title=(sp,code)=>(titles.data||[]).find(x=>x.space_id===sp&&x.code===code)?.title;
    const done=new Map((ses.data||[]).map(s=>[String(s.id),(s.attendance?.[0]?.count||0)>0]));
    const needGrades=new Map((ses.data||[]).map(s=>[String(s.id),(s.ng?.[0]?.count||0)>0]));
    const items=[];const seen=new Set();
    for(const r of s2.data||[]){const sid=r.attendance_session_id?String(r.attendance_session_id):null;if(sid)seen.add(sid);
      items.push({title:`${r.session.class_name}-G${r.group_no}`,detail:[r.manipulation_code+(title(r.space_id,r.manipulation_code)?' — '+title(r.space_id,r.manipulation_code):''),r.room?'Salle '+r.room:''].filter(Boolean).join(' · '),
        start:r.session.start_time,end:r.session.end_time,done:sid?!!done.get(sid):false,needGrades:sid?!!needGrades.get(sid):false,value:sid||`s2:${r.id}`});}
    for(const p of s1.data||[]){if(String(p.status||'').toLowerCase()==='cancelled')continue;const sid=p.session_id?String(p.session_id):null;if(sid)seen.add(sid);
      items.push({title:p.classes?.name||'Séance',detail:[p.manipulation,p.room?'Salle '+p.room:''].filter(Boolean).join(' · '),start:p.start_time,end:p.end_time,done:sid?!!done.get(sid):false,needGrades:sid?!!needGrades.get(sid):false,value:sid||`plan:${p.id}`});}
    for(const s of ses.data||[]){if(seen.has(String(s.id)))continue;items.push({title:s.classes?.name||'Séance',detail:done.get(String(s.id))?'Appel déjà saisi':'Appel non saisi',start:s.start_time,end:s.end_time,done:!!done.get(String(s.id)),needGrades:!!needGrades.get(String(s.id)),value:String(s.id)});}
    return pickNow(items,nowHm());
  }
  async function loadMakeup(){
    const c=client();if(!c||!me())return [];
    const t=todayIso(),from=t>=S2_START?S2_START:'2026-09-01';
    const [abs,plan]=await Promise.all([
      c.from('attendance').select('student_id,students!inner(last_name,first_name),sessions!inner(session_date,deleted_at,classes!inner(name))').eq('status','absent').is('makeup_date',null).is('deleted_at',null).gte('sessions.session_date',from).lte('sessions.session_date',t).limit(2000),
      t>=S2_START||t>='2026-12-12'?c.from('v33_s2_sessions').select('class_name,session_date,start_time,slots:v33_s2_slots(group_no,manipulation_code,room)').gte('session_date',S2_START):Promise.resolve({data:[]})]);
    const rows=(abs.data||[]).filter(a=>!a.sessions?.deleted_at).map(a=>({student_id:a.student_id,name:`${a.students.last_name} ${a.students.first_name}`,date:a.sessions.session_date,class_name:a.sessions.classes.name}));
    return makeupRows(rows,plan.data||[],t);
  }
  async function search(q){
    const c=client(),s=safeQuery(q);if(!c||s.length<2)return [];
    const w=s.split(' ')[0];
    const {data}=await c.from('students').select('id,last_name,first_name,classes(name)').is('deleted_at',null).or(`last_name.ilike.%${w}%,first_name.ilike.%${w}%`).order('last_name').limit(30);
    const words=s.toLowerCase().split(' ');
    return (data||[]).filter(x=>words.every(k=>`${x.last_name} ${x.first_name}`.toLowerCase().includes(k))).slice(0,8);
  }
  async function studentFile(id){
    const c=client();if(!c)return null;
    const {data}=await c.from('attendance').select('status,grade,makeup_date,sessions!inner(session_date,deleted_at,classes(name))').eq('student_id',id).is('deleted_at',null).order('id').limit(400);
    return (data||[]).filter(a=>!a.sessions?.deleted_at).sort((a,b)=>b.sessions.session_date.localeCompare(a.sessions.session_date));
  }

  /* ---------- Affichage ---------- */
  const STATUS={present:['Présent','ok'],absent:['Absent','bad'],retard:['Retard','late'],justifie:['Justifié','late']};
  async function openRollCall(value){
    try{if(typeof root.switchTab==='function')root.switchTab('presence');}catch(_){}
    try{await root.v17LoadOfficialSessionChoices?.();}catch(_){}
    const sel=document.getElementById('presence-session');
    if(sel&&[...sel.options].some(o=>o.value===value)){sel.value=value;try{await root.loadPresenceSheet?.();}catch(_){}}
  }
  function host(){
    const dash=document.getElementById('dashboard');if(!dash)return null;
    let h=document.getElementById('v48-home');
    if(!h){h=document.createElement('div');h.id='v48-home';h.className='v48-home';const title=dash.querySelector(':scope>h2');(title?title.nextSibling:dash.firstChild)?dash.insertBefore(h,title?title.nextSibling:dash.firstChild):dash.appendChild(h);}
    return h;
  }
  let busy=false,last=0;
  async function render(force){
    const dash=document.getElementById('dashboard');
    /* Seulement quand le tableau de bord est affiché : aucune requête en arrière-plan sur les autres pages. */
    if(busy||!me()||!dash||!dash.classList.contains('active')||document.hidden)return;
    if(!force&&Date.now()-last<55000&&document.getElementById('v48-home'))return;
    busy=true;last=Date.now();
    try{
      const h=host();if(!h)return;
      if(!h.children.length)h.innerHTML='<div class="v48-skel" aria-hidden="true"><i class="big"></i><i></i><i></i></div>';
      const [now,mk]=await Promise.all([loadNow().catch(()=>null),loadMakeup().catch(()=>[])]);
      const nowHtml=now?`<section class="v48-now${now.finished&&!now.done?' v48-now-late':''}" aria-label="Séance maintenant"><div class="v48-now-top"><span class="v48-pill">MAINTENANT · ${esc(hm(now.start))} – ${esc(hm(now.end))}</span><span class="v48-when">${esc(now.when)}</span></div>
        <p class="v48-now-title">${esc(now.title)}</p><p class="v48-now-detail">${esc(now.detail)}</p>
        <button type="button" class="v48-now-btn" data-v48-open="${esc(now.value)}"><i class="fas fa-clipboard-check"></i> ${esc(now.action)}</button></section>`:'';
      const mkHtml=`<section class="v48-card"><div class="v48-card-head"><h3>À rattraper</h3><span class="v48-muted">2 absences non rattrapées ou plus</span></div>
        ${mk.length?mk.slice(0,6).map(r=>`<div class="v48-row"><div class="v48-grow"><b>${esc(r.name)}</b><small>${esc(r.class_name)} · manquées : ${r.missed.map(m=>esc(fr(m.date)+(m.manip?' ('+m.manip+')':''))).join(', ')}</small>${r.suggestion?`<small class="v48-sug"><i class="fas fa-rotate-right"></i> Proposé : ${esc(r.suggestion)}</small>`:''}</div><span class="v48-badge">${r.missed.length} abs.</span><button type="button" class="v48-link" data-v48-student="${esc(r.student_id)}">Fiche</button></div>`).join('')
          +(mk.length>6?`<p class="v48-muted">… et ${mk.length-6} autre(s).</p>`:''):'<p class="v48-muted">Aucun étudiant à rattraper pour l’instant.</p>'}</section>`;
      const searchHtml=`<section class="v48-card"><label class="v48-search"><i class="fas fa-search" aria-hidden="true"></i><input type="search" data-v48-q placeholder="Chercher un étudiant" aria-label="Chercher un étudiant" autocomplete="off"></label><div data-v48-results></div><div data-v48-file></div></section>`;
      const keep=h.querySelector('[data-v48-q]')?.value||'';
      h.innerHTML=nowHtml+`<div class="v48-cols">${mkHtml}${searchHtml}</div>`;
      if(keep){const i=h.querySelector('[data-v48-q]');i.value=keep;}
    }finally{busy=false;}
  }
  let timer=null;
  async function onInput(e){
    const box=document.querySelector('#v48-home [data-v48-results]');if(!box)return;
    clearTimeout(timer);timer=setTimeout(async()=>{const list=await search(e.target.value).catch(()=>[]);
      box.innerHTML=list.map(s=>`<button type="button" class="v48-result" data-v48-student="${esc(s.id)}"><b>${esc(s.last_name)} ${esc(s.first_name)}</b><small>${esc(s.classes?.name||'')}</small></button>`).join('')||(safeQuery(e.target.value).length>=2?'<p class="v48-muted">Aucun étudiant trouvé.</p>':'');},250);
  }
  async function showFile(id,name){
    const box=document.querySelector('#v48-home [data-v48-file]');if(!box)return;
    box.innerHTML='<p class="v48-muted">Chargement…</p>';
    const recs=await studentFile(id).catch(()=>null);
    if(!recs){box.innerHTML='<p class="v48-muted">Fiche indisponible.</p>';return;}
    const tot=recs.length,pres=recs.filter(r=>r.status==='present'||r.status==='retard'||r.makeup_date).length,abs=recs.filter(r=>r.status==='absent'&&!r.makeup_date).length;
    const grades=recs.map(r=>Number(r.grade)).filter(Number.isFinite);const avg=grades.length?(grades.reduce((a,b)=>a+b,0)/grades.length).toFixed(1).replace('.',','):'—';
    box.innerHTML=`<div class="v48-file"><p class="v48-file-name">${esc(name||'')}</p><div class="v48-kpis"><div><small>Présence</small><b>${tot?Math.round(pres*100/tot)+' %':'—'}</b></div><div><small>Absences</small><b class="bad">${abs}</b></div><div><small>Moyenne</small><b>${avg}</b></div></div>
      ${recs.slice(0,12).map(r=>{const [l,k]=r.makeup_date?['Rattrapé','ok']:(STATUS[r.status]||[r.status,'']);return `<div class="v48-row"><span class="v48-date">${esc(fr(r.sessions.session_date))}</span><span class="v48-grow">${esc(r.sessions.classes?.name||'')}</span><span class="v48-st ${k}">${esc(l)}</span><b class="v48-grade">${r.grade??'—'}</b></div>`;}).join('')||'<p class="v48-muted">Aucune séance enregistrée.</p>'}</div>`;
  }
  function wire(){
    document.addEventListener('click',e=>{
      const o=e.target.closest('[data-v48-open]');if(o){openRollCall(o.dataset.v48Open);return;}
      const s=e.target.closest('[data-v48-student]');if(s){const name=s.querySelector('b')?.textContent||s.closest('.v48-row')?.querySelector('b')?.textContent;showFile(s.dataset.v48Student,name);
        document.querySelector('#v48-home [data-v48-file]')?.scrollIntoView({behavior:'smooth',block:'nearest'});}
    });
    document.addEventListener('input',e=>{if(e.target.matches?.('#v48-home [data-v48-q]'))onInput(e);});
    /* Retour tactile (téléphone) quand on choisit un statut pendant l'appel. */
    document.addEventListener('change',e=>{if(e.target.matches?.('.presence-select,[name^="status"],select[data-status]'))try{navigator.vibrate?.(8);}catch(_){}});
  }
  if(root.document){
    wire();
    const kick=f=>setTimeout(()=>render(f),120);
    for(const ev of ['fst:shell-ready','fst:tab-activated','fst:auth-changed','v16:role-changed'])root.addEventListener?.(ev,()=>kick(true));
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>kick(true),{once:true});else kick(true);
    setInterval(()=>render(false),60000);
  }
  root.V48Maintenant={pickNow,makeupRows,safeQuery,render};
  if(typeof module!=='undefined')module.exports={pickNow,makeupRows,safeQuery};
})(typeof window!=='undefined'?window:globalThis);
