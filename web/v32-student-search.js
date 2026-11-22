/* V32 — Recherche d'étudiant, modification rapide et rattrapage d'absence.
   Rattrapage : l'absence passe à « présent » (elle ne compte plus comme absence
   dans les statistiques existantes) et garde la date du rattrapage
   (colonnes attendance.makeup_date / makeup_note). */
(function(root){
  'use strict';
  const client=()=>typeof supabaseClient!=='undefined'?supabaseClient:root.supabaseClient;
  const teacher=()=>typeof currentTeacher!=='undefined'?currentTeacher:root.currentTeacher;
  const isAdmin=()=>{const t=teacher();return !!(t&&t.isAdmin&&t.activeMode==='admin');};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v??'').trim().replace(/\s+/g,' ');
  const fmtDate=d=>{if(!d)return'—';const [y,m,j]=String(d).slice(0,10).split('-');return j&&m&&y?`${j}/${m}/${y}`:esc(d);};
  const today=()=>new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10);
  const LABEL={present:'Présent',absent:'Absent',retard:'Retard',justifie:'Justifié'};
  const BADGE={present:'v32-st-present',absent:'v32-st-absent',retard:'v32-st-retard',justifie:'v32-st-justifie'};
  let timer=null,lastQuery='',makeupAvailable=true,classesCache=null;

  function mount(){
    const tab=document.getElementById('etudiants');
    if(!tab||document.getElementById('v32-student-search'))return;
    const box=document.createElement('section');box.id='v32-student-search';box.className='card v32-search';
    box.innerHTML=`<h3><i class="fas fa-magnifying-glass"></i> Rechercher un étudiant</h3>
      <div class="v32-search-bar"><input type="search" class="form-control" id="v32-search-input" placeholder="Nom ou prénom (au moins 2 lettres)" autocomplete="off" aria-label="Rechercher un étudiant"></div>
      <div id="v32-search-results" class="v32-results" aria-live="polite"></div>
      <div id="v32-student-detail"></div>`;
    const title=tab.querySelector('h2');
    if(title)title.insertAdjacentElement('afterend',box);else tab.prepend(box);
    box.querySelector('#v32-search-input').addEventListener('input',ev=>{clearTimeout(timer);timer=setTimeout(()=>search(ev.target.value),300);});
  }

  async function search(q){
    q=norm(q);lastQuery=q;
    const out=document.getElementById('v32-search-results');if(!out)return;
    document.getElementById('v32-student-detail').innerHTML='';
    if(q.length<2){out.innerHTML='';return;}
    const c=client();if(!c){out.innerHTML='<p class="v32-muted">Connexion requise.</p>';return;}
    out.innerHTML='<p class="v32-muted">Recherche…</p>';
    const words=q.split(' ').filter(Boolean).slice(0,3);
    let req=c.from('students').select('id,last_name,first_name,class_id,classes(name)').is('deleted_at',null).limit(40);
    for(const w of words){const p='%'+w.replace(/[%_,()]/g,'')+'%';req=req.or(`last_name.ilike.${p},first_name.ilike.${p}`);}
    const {data,error}=await req;
    if(q!==lastQuery)return;
    if(error){out.innerHTML=`<p class="v32-error">Recherche impossible : ${esc(error.message)}</p>`;return;}
    const rows=(data||[]).sort((a,b)=>(norm(a.last_name)+' '+norm(a.first_name)).localeCompare(norm(b.last_name)+' '+norm(b.first_name),'fr'));
    if(!rows.length){out.innerHTML='<p class="v32-muted">Aucun étudiant trouvé.</p>';return;}
    out.innerHTML=rows.map(s=>`<button type="button" class="v32-result" data-id="${esc(s.id)}"><span class="v32-result-name">${esc(norm(s.last_name)+' '+norm(s.first_name))}</span><span class="v32-chip">${esc(s.classes?.name||'—')}</span></button>`).join('');
    out.querySelectorAll('.v32-result').forEach(b=>b.addEventListener('click',()=>{out.querySelectorAll('.v32-result').forEach(x=>x.classList.toggle('is-active',x===b));openStudent(rows.find(r=>r.id===b.dataset.id));}));
  }

  async function loadAttendance(c,studentId){
    const cols='id,status,grade,grade_origin,comment,session_id,makeup_date,makeup_note,sessions(session_date,start_time,end_time,classes(name))';
    let r=await c.from('attendance').select(cols).eq('student_id',studentId);
    if(r.error&&/makeup_/.test(r.error.message||'')){makeupAvailable=false;r=await c.from('attendance').select(cols.replace(',makeup_date,makeup_note','')).eq('student_id',studentId);}
    else if(!r.error)makeupAvailable=true;
    return r;
  }

  async function openStudent(s){
    const box=document.getElementById('v32-student-detail');if(!box||!s)return;
    const c=client();
    box.innerHTML='<p class="v32-muted">Chargement…</p>';
    const {data,error}=await loadAttendance(c,s.id);
    if(error){box.innerHTML=`<p class="v32-error">Impossible de charger les séances : ${esc(error.message)}</p>`;return;}
    const rows=(data||[]).sort((a,b)=>String(a.sessions?.session_date||'').localeCompare(String(b.sessions?.session_date||'')));
    const absences=rows.filter(a=>a.status==='absent'&&!a.makeup_date).length;
    const makeups=rows.filter(a=>a.makeup_date).length;
    box.innerHTML=`<div class="v32-student-card">
      <div class="v32-student-head"><div><h4>${esc(norm(s.last_name)+' '+norm(s.first_name))}</h4><span class="v32-chip">${esc(s.classes?.name||'—')}</span></div>
      ${isAdmin()?'<button type="button" class="btn btn-info btn-sm" data-act="edit"><i class="fas fa-pen"></i> Modifier</button>':''}</div>
      <div class="v32-kpis"><span><strong>${rows.length}</strong> séance(s)</span><span class="v32-kpi-abs"><strong>${absences}</strong> absence(s)</span><span class="v32-kpi-mk"><strong>${makeups}</strong> rattrapage(s)</span></div>
      <div class="v32-edit-slot"></div>
      ${rows.length?`<div class="v32-sessions">${rows.map(a=>sessionRow(a)).join('')}</div>`:'<p class="v32-muted">Aucune séance enregistrée pour cet étudiant.</p>'}
      ${makeupAvailable?'':'<p class="v32-muted">Le rattrapage sera disponible dès la mise à jour de la base de données.</p>'}</div>`;
    box.querySelector('[data-act=edit]')?.addEventListener('click',()=>editForm(s,box));
    box.querySelectorAll('[data-makeup]').forEach(b=>b.addEventListener('click',()=>makeupForm(b.closest('.v32-session'),s)));
    box.querySelectorAll('[data-undo]').forEach(b=>b.addEventListener('click',()=>undoMakeup(b.dataset.undo,s)));
  }

  function sessionRow(a){
    const ses=a.sessions||{};
    const mk=a.makeup_date;
    const label=mk?`Rattrapé le ${fmtDate(mk)}`:(LABEL[a.status]||esc(a.status));
    const cls=mk?'v32-st-makeup':(BADGE[a.status]||'');
    const canMakeup=makeupAvailable&&!mk&&(a.status==='absent'||a.status==='justifie');
    return `<div class="v32-session" data-att="${esc(a.id)}" data-status="${esc(a.status)}" data-origin="${esc(a.grade_origin||'')}">
      <div class="v32-session-main"><span class="v32-date">${fmtDate(ses.session_date)}</span><span class="v32-muted">${esc(ses.classes?.name||'')} ${esc((ses.start_time||'').slice(0,5))}</span></div>
      <span class="v32-status ${cls}">${label}</span>
      ${a.grade!=null&&!(a.status==='absent'&&!mk)?`<span class="v32-grade">${esc(a.grade)}/20</span>`:''}
      ${canMakeup?'<button type="button" class="btn btn-sm btn-primary" data-makeup>Rattrapé</button>':''}
      ${mk?`<button type="button" class="btn btn-sm btn-info" data-undo="${esc(a.id)}" title="Annuler le rattrapage">Annuler</button>`:''}
      ${a.makeup_note?`<div class="v32-note">${esc(a.makeup_note)}</div>`:''}
      <div class="v32-inline-slot"></div></div>`;
  }

  function makeupForm(row,s){
    const slot=row.querySelector('.v32-inline-slot');
    if(slot.innerHTML){slot.innerHTML='';return;}
    slot.innerHTML=`<div class="v32-inline-form"><label>Date du rattrapage<input type="date" class="form-control" value="${today()}" data-f="date"></label>
      <label>Remarque (facultatif)<input type="text" class="form-control" maxlength="300" placeholder="Ex : avec le groupe G2" data-f="note"></label>
      <button type="button" class="btn btn-primary" data-f="ok"><i class="fas fa-check"></i> Confirmer</button></div>`;
    slot.querySelector('[data-f=ok]').addEventListener('click',async ev=>{
      const date=slot.querySelector('[data-f=date]').value,note=norm(slot.querySelector('[data-f=note]').value);
      if(!date){root.showAlert?.('Choisissez la date du rattrapage.','danger');return;}
      ev.target.disabled=true;
      const patch={status:'present',makeup_date:date,makeup_note:note||null};
      if(row.dataset.origin==='absence_auto'){patch.grade=null;patch.grade_origin=null;}
      const {error}=await client().from('attendance').update(patch).eq('id',row.dataset.att);
      if(error){ev.target.disabled=false;root.showAlert?.('Rattrapage non enregistré : '+error.message,'danger');return;}
      root.showAlert?.('Rattrapage enregistré : l’absence ne compte plus.','success');
      openStudent(s);
    });
  }

  async function undoMakeup(id,s){
    if(!confirm('Annuler ce rattrapage ? La séance redeviendra une absence.'))return;
    const {error}=await client().from('attendance').update({status:'absent',makeup_date:null,makeup_note:null}).eq('id',id);
    if(error){root.showAlert?.('Annulation impossible : '+error.message,'danger');return;}
    root.showAlert?.('Rattrapage annulé.','success');openStudent(s);
  }

  async function editForm(s,box){
    const slot=box.querySelector('.v32-edit-slot');
    if(slot.innerHTML){slot.innerHTML='';return;}
    const c=client();
    if(!classesCache){const {data}=await c.from('classes').select('id,name').is('deleted_at',null).order('name');classesCache=data||[];}
    slot.innerHTML=`<div class="v32-inline-form"><label>Nom<input type="text" class="form-control" data-f="last" value="${esc(norm(s.last_name))}"></label>
      <label>Prénom<input type="text" class="form-control" data-f="first" value="${esc(norm(s.first_name))}"></label>
      <label>Groupe<select class="form-control" data-f="cls">${classesCache.map(k=>`<option value="${esc(k.id)}" ${k.id===s.class_id?'selected':''}>${esc(k.name)}</option>`).join('')}</select></label>
      <button type="button" class="btn btn-primary" data-f="ok"><i class="fas fa-check"></i> Enregistrer</button></div>`;
    slot.querySelector('[data-f=ok]').addEventListener('click',async ev=>{
      const last=norm(slot.querySelector('[data-f=last]').value),first=norm(slot.querySelector('[data-f=first]').value),cls=slot.querySelector('[data-f=cls]').value;
      if(!last){root.showAlert?.('Le nom est obligatoire.','danger');return;}
      ev.target.disabled=true;
      const {error}=await c.from('students').update({last_name:last,first_name:first,class_id:cls}).eq('id',s.id);
      if(error){ev.target.disabled=false;root.showAlert?.('Modification impossible : '+error.message,'danger');return;}
      root.showAlert?.('Étudiant mis à jour.','success');
      Object.assign(s,{last_name:last,first_name:first,class_id:cls,classes:{name:classesCache.find(k=>k.id===cls)?.name||''}});
      openStudent(s);search(document.getElementById('v32-search-input')?.value||'');
    });
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
  setInterval(mount,2000);
  root.V32StudentSearch={search,openStudent};
})(typeof globalThis!=='undefined'?globalThis:this);
