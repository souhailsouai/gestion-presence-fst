(function(){
'use strict';
let state={bootstrap:null,cycleId:null,snapshot:null,verification:null};
const ids={root:'v515-admin-console',style:'v515-admin-styles'};
const MANIPS=['M1','M2','M3','M4','M5','M6'];
const FSTV515Api=window.FSTV515Api;
function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
function time(v){return String(v||'').slice(0,5);}
function isAdmin(){return Boolean(currentTeacher?.isAdmin||currentTeacher?.role==='admin'||currentTeacher?.activeMode==='admin');}
function notify(message,type='success'){if(typeof showAlert==='function')showAlert(message,type);}
function installStyles(){
  if(document.getElementById(ids.style))return;
  const s=document.createElement('style');s.id=ids.style;s.textContent=`
#${ids.root}{margin-top:28px;border-top:2px solid #dce6f0;padding-top:22px}
#${ids.root} .v515-admin-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}
#${ids.root} .v515-admin-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:14px;margin:14px 0}
#${ids.root} .v515-admin-card{border:1px solid #dbe4ee;border-radius:10px;padding:14px;background:#fff;box-shadow:0 3px 10px rgba(0,0,0,.04)}
#${ids.root} .v515-admin-card h4{color:#092f63;margin:0 0 10px}
#${ids.root} .v515-form-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:8px}
#${ids.root} .v515-inline{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
#${ids.root} .v515-section{margin:22px 0}
#${ids.root} .v515-section>h3{color:#092f63;border-bottom:1px solid #e5ebf1;padding-bottom:8px}
#${ids.root} .v515-manips{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}
#${ids.root} .v515-manips label{display:inline-flex;align-items:center;gap:3px}
#${ids.root} .v515-error-list{padding-left:20px;color:#842029}
#${ids.root} .v515-ok{color:#155724}.v515-warning{color:#856404}.v515-muted{color:#6c757d}
#${ids.root} .v515-position-actions{display:flex;gap:5px;flex-wrap:wrap}
`;document.head.appendChild(s);
}
function host(){return document.getElementById('v515-planning')||document.querySelector('.content');}
function install(){
  if(!isAdmin())return false;
  installStyles();
  const h=host();if(!h)return false;
  let root=document.getElementById(ids.root);
  if(!root){root=document.createElement('section');root.id=ids.root;root.innerHTML='<div class="v515-admin-head"><h2><i class="fas fa-user-shield"></i> Administration V5.15</h2><button type="button" class="btn btn-info" data-v515-admin-action="refresh">Actualiser</button></div><div id="v515-admin-body"><p class="v515-muted">Chargement…</p></div>';root.addEventListener('click',onClick);root.addEventListener('change',onChange);h.appendChild(root);}
  return true;
}
function option(value,label,selected){return `<option value="${esc(value)}"${selected?' selected':''}>${esc(label)}</option>`;}
function currentCycle(){return (state.bootstrap?.cycles||[]).find(x=>String(x.id)===String(state.cycleId))||state.snapshot?.cycle||null;}
function classConfigs(){return state.snapshot?.classes||[];}
function rostersFor(classId){return (state.snapshot?.rosters||[]).filter(r=>String(r.class_config_id)===String(classId));}
function teacherById(id){return (state.snapshot?.teachers||[]).find(t=>String(t.teacher_id)===String(id))||(state.bootstrap?.teachers||[]).find(t=>String(t.teacher_id)===String(id));}
function positionById(id){return (state.snapshot?.positions||[]).find(p=>String(p.position_id)===String(id));}
function eligibleTeachersForPosition(position){
  return (state.snapshot?.teachers||[]).filter(t=>{
    if(t.active===false||Number(t.remaining_quota)<=0)return false;
    if(!(t.manipulations||[]).includes(position.manipulation_code))return false;
    return !(state.snapshot?.positions||[]).some(q=>String(q.assignment_teacher_id||'')===String(t.teacher_id)&&q.date===position.date&&q.start_time < position.end_time&&q.end_time > position.start_time);
  });
}
function cycleChooser(){
  const years=state.bootstrap?.academic_years||[],cycles=state.bootstrap?.cycles||[];
  const yearOpts=years.map(y=>option(y.id,y.code||y.id,y.is_active)).join('');
  const cycleOpts='<option value="">Sélectionner un cycle</option>'+cycles.map(c=>option(c.id,`${c.name} — ${c.status}`,String(c.id)===String(state.cycleId))).join('');
  return `<div class="v515-section"><h3>Cycle pédagogique</h3><div class="v515-admin-card"><div class="v515-form-grid"><select id="v515-admin-cycle" class="form-control">${cycleOpts}</select><select id="v515-cycle-year" class="form-control">${yearOpts}</select><input id="v515-cycle-name" class="form-control" placeholder="Nom du cycle" value="${esc(currentCycle()?.name||'TP Physique V5.15')}"><input id="v515-cycle-start" class="form-control" type="date" value="${esc(currentCycle()?.start_date||'')}"><input id="v515-cycle-end" class="form-control" type="date" value="${esc(currentCycle()?.end_date||'')}"><input id="v515-cycle-anchor" class="form-control" type="date" title="Semaine A" value="${esc(currentCycle()?.week_a_anchor_date||'')}"></div><div class="v515-inline" style="margin-top:10px"><button class="btn btn-primary" data-v515-admin-action="save-cycle">Enregistrer le cycle</button><span class="v515-muted">Semaine A : date d’ancrage utilisée pour l’alternance.</span></div></div></div>`;
}
function classSection(){
  const configured=new Map(classConfigs().map(c=>[c.class_key,c]));
  const families=state.bootstrap?.class_families||[];
  const rows=families.map(f=>{
    const c=configured.get(f.class_key)||{};const count=Number(c.group_count||4);const rs=c.id?rostersFor(c.id):[];
    const mapped=new Set(rs.map(r=>Number(r.group_no)));
    const badges=Array.from({length:count},(_,i)=>`<span class="badge ${mapped.has(i+1)?'badge-present':'badge-info'}">G${i+1}${mapped.has(i+1)?' ✓':''}</span>`).join(' ');
    return `<div class="v515-admin-card" data-class-key="${esc(f.class_key)}"><h4>${esc(f.display_name)}</h4><div class="v515-inline"><label>Groupes <select class="form-control v515-group-count" style="width:auto">${[1,2,3,4,5,6].map(n=>option(n,n,n===count)).join('')}</select></label><label><input type="checkbox" class="v515-class-active" ${c.active===false?'':'checked'}> Active</label></div><div style="margin:8px 0">${badges}</div><div class="v515-inline"><button class="btn btn-sm btn-primary" data-v515-admin-action="save-class" data-config-id="${esc(c.id||'')}">Enregistrer</button>${c.id?`<button class="btn btn-sm btn-info" data-v515-admin-action="prepare-groups" data-config-id="${esc(c.id)}">Préparer les groupes</button>`:''}</div><input type="hidden" class="v515-class-track" value="${esc(f.track||'')}"><input type="hidden" class="v515-class-number" value="${esc(f.class_number??'')}"><input type="hidden" class="v515-class-name" value="${esc(f.display_name)}"></div>`;
  }).join('');
  return `<div class="v515-section"><h3>Configuration des classes et Groupes</h3><p class="v515-muted">Nombre configurable de 1 à 6, valeur par défaut 4. Les groupes manquants peuvent être créés automatiquement.</p><div class="v515-admin-grid">${rows||'<div class="alert alert-warning">Aucune classe de TP Physique trouvée.</div>'}</div></div>`;
}
function timeslotSection(){
  const classes=classConfigs().filter(c=>c.active!==false);const classOpts=classes.map(c=>option(c.id,c.display_name,false)).join('');
  const existing=(state.snapshot?.pairs||[]).map(pair=>{
    const ts=(state.snapshot?.timeslots||[]).find(x=>String(x.id)===String(pair.timeslot_id));
    const a=classes.find(c=>String(c.id)===String(pair.week_a_class_config_id));const b=classes.find(c=>String(c.id)===String(pair.week_b_class_config_id));
    return `<tr><td>${esc(ts?.day_of_week||'')}</td><td>${esc(time(ts?.start_time))}-${esc(time(ts?.end_time))}</td><td>${esc(ts?.room||'—')}</td><td>${esc(a?.display_name||'—')}</td><td>${esc(b?.display_name||'—')}</td></tr>`;
  }).join('');
  return `<div class="v515-section"><h3>Créneaux et alternance Semaine A / Semaine B</h3><div class="v515-admin-card"><div class="v515-form-grid"><select id="v515-slot-day" class="form-control">${[['1','Lundi'],['2','Mardi'],['3','Mercredi'],['4','Jeudi'],['5','Vendredi'],['6','Samedi'],['7','Dimanche']].map(x=>option(x[0],x[1],false)).join('')}</select><input id="v515-slot-start" class="form-control" type="time"><input id="v515-slot-end" class="form-control" type="time"><input id="v515-slot-room" class="form-control" placeholder="Salle"><select id="v515-slot-a" class="form-control"><option value="">Semaine A</option>${classOpts}</select><select id="v515-slot-b" class="form-control"><option value="">Semaine B</option>${classOpts}</select></div><button class="btn btn-primary" style="margin-top:10px" data-v515-admin-action="save-slot">Ajouter le créneau</button></div><div class="table-responsive"><table class="table"><thead><tr><th>Jour</th><th>Horaire</th><th>Salle</th><th>Semaine A</th><th>Semaine B</th></tr></thead><tbody>${existing||'<tr><td colspan="5">Aucun créneau.</td></tr>'}</tbody></table></div></div>`;
}
function lifecycleSection(){const c=currentCycle();const status=c?.status||'—';const canDraft=status==='DRAFT';const canOpen=status==='DRAFT'&&Boolean((state.snapshot?.positions||[]).length);const canReset=['OPEN_FOR_REQUESTS','ASSIGNMENT'].includes(status);const canFinalize=Boolean(state.verification?.ok);return `<div class="v515-section"><h3>Génération et publication</h3><div class="v515-admin-card"><div class="v515-inline"><span>Statut : <strong>${esc(status)}</strong></span><button class="btn btn-primary" data-v515-admin-action="generate" ${!canDraft?'disabled':''}>Générer le planning</button><button class="btn btn-success" data-v515-admin-action="open" ${!canOpen?'disabled':''}>Ouvrir les demandes</button><button class="btn btn-info" data-v515-admin-action="verify">Vérifier le planning</button><button class="btn btn-success" data-v515-admin-action="finalize" ${!canFinalize?'disabled':''}>Finaliser</button><button class="btn btn-warning" data-v515-admin-action="reset" ${!canReset?'disabled':''}>Réinitialiser</button></div>${verificationHtml()}</div></div>`;}
function verificationHtml(){if(!state.verification)return '<p class="v515-muted">Aucune vérification exécutée.</p>';if(state.verification.ok)return `<p class="v515-ok"><strong>Planning valide.</strong> ${esc(state.verification.counts?.assigned??'')} affectations contrôlées.</p>`;const errs=state.verification.errors||[];return `<div class="alert alert-danger"><div><strong>Planning non finalisable.</strong><ul class="v515-error-list">${errs.map(e=>`<li>${esc(e.code)}${e.position_id?' — '+esc(e.position_id):''}${e.class_name?' — '+esc(e.class_name):''}</li>`).join('')}</ul></div></div>`;}
function teachersSection(){
  const configured=new Map((state.snapshot?.teachers||[]).map(t=>[String(t.teacher_id),t]));const teachers=state.bootstrap?.teachers||[];
  const cards=teachers.map(t=>{const c=configured.get(String(t.teacher_id))||{};const ms=new Set(c.manipulations||[]);return `<div class="v515-admin-card" data-teacher-id="${esc(t.teacher_id)}"><h4>${esc(t.teacher_name)}</h4><div class="v515-inline"><label>Quota <input class="form-control v515-teacher-quota" type="number" min="0" value="${esc(c.quota??0)}" style="width:95px"></label><label><input class="v515-teacher-active" type="checkbox" ${c.active===false?'':'checked'}> Actif</label></div><div class="v515-manips"><strong>Manipulations</strong>${MANIPS.map(m=>`<label><input class="v515-teacher-manip" type="checkbox" value="${m}" ${ms.has(m)?'checked':''}> ${m}</label>`).join('')}</div><p class="v515-muted">Validées: ${esc(c.validated_count??0)} · En attente: ${esc(c.pending_count??0)} · Restantes: ${esc(c.remaining_quota??c.quota??0)}</p><button class="btn btn-sm btn-primary" data-v515-admin-action="save-teacher">Enregistrer</button></div>`;}).join('');
  return `<div class="v515-section"><h3>Enseignants — Quota et Manipulations</h3><p class="v515-muted">Les nouveaux comptes sont créés avec le gestionnaire d’enseignants existant, puis configurés ici.</p><div class="v515-admin-grid">${cards||'<p>Aucun enseignant.</p>'}</div></div>`;
}
function candidatesSection(){
  const pending=(state.snapshot?.requests||[]).filter(r=>r.status==='PENDING');const grouped=new Map();for(const r of pending){if(!grouped.has(r.position_id))grouped.set(r.position_id,[]);grouped.get(r.position_id).push(r);}
  const cards=[...grouped.entries()].map(([pid,rs])=>{const p=positionById(pid);return `<div class="v515-admin-card"><h4>${esc(p?.class_name||'Séance')} · G${esc(p?.group_no||'')} · ${esc(p?.manipulation_code||'')}</h4><p>${esc(p?.date||'')} ${esc(time(p?.start_time))}-${esc(time(p?.end_time))} · ${esc(p?.room||'—')}</p>${rs.map(r=>{const t=teacherById(r.teacher_id)||{};return `<div class="v515-inline" style="margin:6px 0"><span>${esc(r.teacher_name)} · quota restant ${esc(t.remaining_quota??t.quota??'—')}</span><button class="btn btn-sm btn-success" data-v515-admin-action="accept" data-request-id="${esc(r.request_id)}">Valider</button><button class="btn btn-sm btn-danger" data-v515-admin-action="reject" data-request-id="${esc(r.request_id)}">Refuser</button></div>`;}).join('')}</div>`;}).join('');
  return `<div class="v515-section"><h3>Candidats</h3><div class="v515-admin-grid">${cards||'<p>Aucune demande en attente.</p>'}</div></div>`;
}
function uncoveredSection(){
  const positions=(state.snapshot?.positions||[]).filter(p=>!p.assignment_teacher_id&&p.status!=='CANCELLED');const rows=positions.map(p=>{const tOpts=eligibleTeachersForPosition(p).map(t=>option(t.teacher_id,`${t.teacher_name} (reste ${t.remaining_quota})`,false)).join('');return `<tr data-position-id="${esc(p.position_id)}"><td>${esc(p.class_name)}</td><td>${esc(p.date)}</td><td>${esc(time(p.start_time))}-${esc(time(p.end_time))}</td><td>G${esc(p.group_no)}</td><td>${esc(p.manipulation_code)}</td><td>${esc(p.room||'—')}</td><td><select class="form-control v515-direct-teacher"><option value="">Enseignant compatible</option>${tOpts}</select></td><td class="v515-position-actions"><button class="btn btn-sm btn-primary" data-v515-admin-action="assign">Affecter</button><button class="btn btn-sm btn-warning" data-v515-admin-action="cancel-position">Annuler séance</button><button class="btn btn-sm btn-info" data-v515-admin-action="rotation">Rotation</button></td></tr>`;}).join('');
  const cancelled=(state.snapshot?.positions||[]).filter(p=>p.status==='CANCELLED').map(p=>`<tr data-position-id="${esc(p.position_id)}"><td>${esc(p.class_name)}</td><td>${esc(p.date)}</td><td>G${esc(p.group_no)}</td><td>${esc(p.manipulation_code)}</td><td><button class="btn btn-sm btn-primary" data-v515-admin-action="catchup">Rattrapage</button></td></tr>`).join('');
  return `<div class="v515-section"><h3>Postes non couverts</h3><div class="table-responsive"><table class="table"><thead><tr><th>Classe</th><th>Date</th><th>Horaire</th><th>Groupe</th><th>Manip.</th><th>Salle</th><th>Enseignant</th><th>Actions</th></tr></thead><tbody>${rows||'<tr><td colspan="8">Aucun poste non couvert.</td></tr>'}</tbody></table></div><h4>Séances annulées / Rattrapage</h4><div class="table-responsive"><table class="table"><tbody>${cancelled||'<tr><td>Aucune séance annulée.</td></tr>'}</tbody></table></div></div>`;
}
function render(){const body=document.getElementById('v515-admin-body');if(!body)return;body.innerHTML=cycleChooser()+(state.cycleId?classSection()+timeslotSection()+lifecycleSection()+teachersSection()+candidatesSection()+uncoveredSection():'<div class="alert alert-info">Sélectionnez ou créez un cycle V5.15.</div>');}
async function loadSnapshot(){state.snapshot=state.cycleId?await FSTV515Api.adminSnapshot(state.cycleId):null;}
async function refresh(cycleId){if(!isAdmin())return false;install();const body=document.getElementById('v515-admin-body');try{state.bootstrap=await FSTV515Api.adminBootstrap()||{};if(cycleId)state.cycleId=cycleId;if(!state.cycleId&&state.bootstrap.cycles?.length)state.cycleId=state.bootstrap.cycles[0].id;await loadSnapshot();render();return true;}catch(e){if(body)body.innerHTML=`<div class="alert alert-danger">${esc(e.message||'Chargement administrateur impossible.')}</div>`;return false;}}
async function busy(button,fn){if(button)button.disabled=true;try{await fn();await refresh(state.cycleId);}catch(e){notify(e.message||'Opération impossible.','danger');if(button)button.disabled=false;}}
function val(id){return document.getElementById(id)?.value||'';}
async function onClick(event){const b=event.target.closest?.('[data-v515-admin-action]');if(!b)return;const action=b.dataset.v515AdminAction;
  if(action==='refresh')return void refresh(state.cycleId);
  if(action==='save-cycle')return void busy(b,async()=>{const r=await FSTV515Api.upsertCycle({id:state.cycleId||null,academicYearId:val('v515-cycle-year'),name:val('v515-cycle-name'),startDate:val('v515-cycle-start'),endDate:val('v515-cycle-end'),weekAAnchorDate:val('v515-cycle-anchor')});state.cycleId=r.cycle_id;state.verification=null;notify('Cycle enregistré.');});
  if(action==='save-class')return void busy(b,async()=>{const card=b.closest('[data-class-key]');const r=await FSTV515Api.upsertClassConfig({id:b.dataset.configId||null,cycleId:state.cycleId,classKey:card.dataset.classKey,track:card.querySelector('.v515-class-track').value||null,classNumber:Number(card.querySelector('.v515-class-number').value)||null,displayName:card.querySelector('.v515-class-name').value,groupCount:Number(card.querySelector('.v515-group-count').value),active:card.querySelector('.v515-class-active').checked});notify(`Classe configurée (${r.group_count} groupes).`);});
  if(action==='prepare-groups')return void busy(b,async()=>{const id=b.dataset.configId;const cc=classConfigs().find(x=>String(x.id)===String(id));const mapped=new Set(rostersFor(id).map(r=>Number(r.group_no)));for(let g=1;g<=Number(cc?.group_count||0);g++)if(!mapped.has(g))await FSTV515Api.createRosterGroup(id,g);notify('Groupes préparés.');});
  if(action==='save-slot')return void busy(b,async()=>{const a=val('v515-slot-a'),bb=val('v515-slot-b');if(!a||!bb)throw new Error('Sélectionnez les classes Semaine A et Semaine B.');const ts=await FSTV515Api.upsertTimeslot({dayOfWeek:Number(val('v515-slot-day')),start:val('v515-slot-start'),end:val('v515-slot-end'),room:val('v515-slot-room'),active:true});await FSTV515Api.setFortnightPair(state.cycleId,ts.timeslot_id,a,bb);notify('Créneau A/B enregistré.');});
  if(action==='generate')return void busy(b,async()=>{await FSTV515Api.generateCycle(state.cycleId);state.verification=null;notify('Planning généré.');});
  if(action==='open')return void busy(b,async()=>{await FSTV515Api.openCycle(state.cycleId);notify('Demandes ouvertes.');});
  if(action==='reset')return void (confirm('Réinitialiser ce cycle ? Les demandes en attente et affectations non finales seront annulées.')&&busy(b,async()=>{await FSTV515Api.resetCycle(state.cycleId);state.verification=null;notify('Cycle réinitialisé.');}));
  if(action==='verify')return void busy(b,async()=>{state.verification=await FSTV515Api.verifyCycle(state.cycleId);notify(state.verification.ok?'Planning valide.':'Des anomalies bloquent la finalisation.',state.verification.ok?'success':'warning');});
  if(action==='finalize')return void busy(b,async()=>{if(!state.verification?.ok)throw new Error('Exécutez d’abord « Vérifier le planning ».');await FSTV515Api.finalizeCycle(state.cycleId);state.verification=null;notify('Planning finalisé.');});
  if(action==='save-teacher')return void busy(b,async()=>{const card=b.closest('[data-teacher-id]');const ms=[...card.querySelectorAll('.v515-teacher-manip:checked')].map(x=>x.value);await FSTV515Api.setTeacherConfig(card.dataset.teacherId,Number(card.querySelector('.v515-teacher-quota').value),card.querySelector('.v515-teacher-active').checked,ms);notify('Configuration enseignant enregistrée.');});
  if(action==='accept')return void busy(b,async()=>{await FSTV515Api.acceptRequest(b.dataset.requestId);state.verification=null;notify('Candidat validé.');});
  if(action==='reject')return void busy(b,async()=>{await FSTV515Api.rejectRequest(b.dataset.requestId);notify('Demande refusée.');});
  const row=b.closest('[data-position-id]');const pid=row?.dataset.positionId;
  if(action==='assign')return void busy(b,async()=>{const tid=row.querySelector('.v515-direct-teacher').value;if(!tid)throw new Error('Sélectionnez un enseignant.');await FSTV515Api.directAssign(pid,tid);state.verification=null;notify('Enseignant affecté.');});
  if(action==='cancel-position')return void (confirm('Annuler cette séance ?')&&busy(b,async()=>{await FSTV515Api.cancelPosition(pid);state.verification=null;notify('Séance annulée.');}));
  if(action==='rotation')return void busy(b,async()=>{const current=positionById(pid)?.manipulation_code||'M1';const m=prompt('Manipulation exceptionnelle (M1 à M6)',current);if(!m)return;await FSTV515Api.setRotationException(pid,String(m).toUpperCase());state.verification=null;notify('Rotation modifiée.');});
  if(action==='catchup')return void busy(b,async()=>{const d=prompt('Date du rattrapage (AAAA-MM-JJ)');if(!d)return;const s=prompt('Heure de début (HH:MM)','13:45');if(!s)return;const e=prompt('Heure de fin (HH:MM)','16:45');if(!e)return;const room=prompt('Salle','');await FSTV515Api.createCatchup(pid,d,s,e,room||null);state.verification=null;notify('Rattrapage créé.');});
}
function onChange(event){if(event.target?.id==='v515-admin-cycle'){state.cycleId=event.target.value||null;state.verification=null;void refresh(state.cycleId);}}
function destroy(){document.getElementById(ids.root)?.remove();document.getElementById(ids.style)?.remove();state={bootstrap:null,cycleId:null,snapshot:null,verification:null};}
window.FSTV515AdminUI={install,refresh,destroy};
})();
