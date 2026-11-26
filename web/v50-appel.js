/* V50 — Écran d'appel « liste rapide ».
 * Habille la feuille de présence (#presence-sheet) déjà rendue par les couches existantes,
 * sans changer leur logique : chaque <select class="presence-select"> reste la source de vérité
 * (il est seulement masqué), les boutons P / A / R / J le modifient puis déclenchent « change »,
 * donc updateAttendance(...) et l'enregistrement d'origine continuent de fonctionner.
 * Ajouts : compteur en direct, filtres (Tous / Absents / Retards / Sans note), recherche,
 * bande de couleur par statut, « Annuler » quelques secondes, barre d'enregistrement fixe
 * qui indique « Non enregistré · N changements » tant que l'appel n'est pas enregistré.
 */
(function(root){
  'use strict';
  const STATUSES=[['present','P','Présent'],['absent','A','Absent'],['retard','R','Retard'],['justifie','J','Justifié']];
  const LABEL=Object.fromEntries(STATUSES.map(([v,,l])=>[v,l]));
  const dirtyBySession=new Map();   // séance -> Set(étudiants dont commentaire/note a changé), gardé si la feuille est redessinée
  const origBySession=new Map();    // séance -> Map(étudiant -> statut au dernier enregistrement)
  let undoTimer=null,filter='all',query='';

  function norm(s){return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();}
  function sessionId(doc){return doc.getElementById('presence-session')?.value||'';}
  function dirtySet(doc){const id=sessionId(doc);if(!dirtyBySession.has(id))dirtyBySession.set(id,new Set());return dirtyBySession.get(id);}
  function origMap(doc){const id=sessionId(doc);if(!origBySession.has(id))origBySession.set(id,new Map());return origBySession.get(id);}
  /** Nombre d'étudiants modifiés : statut différent du dernier enregistrement, ou note/commentaire changés (pur, testé). */
  function changedCount(current,orig,touched){
    const ids=new Set(touched);
    for(const [id,st] of current)if(orig.has(id)&&orig.get(id)!==st)ids.add(id);
    return ids.size;
  }
  function changes(sheet){
    const doc=sheet.ownerDocument,cur=new Map(rows(sheet).map(tr=>[tr.dataset.v50Id,statusOf(tr)]));
    return changedCount(cur,origMap(doc),dirtySet(doc));
  }
  function rowKey(tr,i){const m=String(tr.querySelector('select.presence-select')?.getAttribute('onchange')||tr.querySelector('input')?.getAttribute('onchange')||'').match(/'[^']*'\s*,\s*'([^']+)'/);return m?m[1]:'row'+i;}
  function nameOf(tr){
    const cells=[...tr.children].filter(td=>!td.dataset.v17NoCell&&!td.querySelector('select,input,button,.v50-seg'));
    return (cells[0]?.textContent||'').trim();
  }
  function statusOf(tr){const sel=tr.querySelector('select.presence-select');return sel?sel.value:(tr.dataset.v50Status||'present');}
  function gradeEmpty(tr){const g=tr.querySelector('input[type="number"]');return !g||String(g.value).trim()==='';}

  /** Compte les statuts des lignes (fonction pure, testée). */
  function counts(statuses){
    const c={present:0,absent:0,retard:0,justifie:0,total:0};
    for(const s of statuses){if(c[s]!=null)c[s]++;c.total++;}
    return c;
  }
  /** Une ligne est-elle visible pour ce filtre et cette recherche ? (pure, testée) */
  function visible(row,f,q){
    if(q&&!norm(row.name).includes(norm(q)))return false;
    if(f==='absent')return row.status==='absent';
    if(f==='retard')return row.status==='retard';
    if(f==='nograde')return (row.status==='present'||row.status==='retard')&&row.gradeEmpty;
    return true;
  }
  /** Texte de la barre d'enregistrement (pur, testé). */
  function barText(n,justSaved,neverSaved){
    if(n>0)return {state:'dirty',title:'Non enregistré',sub:n===1?'1 changement':n+' changements'};
    if(justSaved)return {state:'saved',title:'Enregistré',sub:'à l’instant'};
    if(neverSaved)return {state:'dirty',title:'Appel pas encore enregistré',sub:'Touchez « Enregistrer » à la fin'};
    return {state:'idle',title:'Aucun changement',sub:'Appel déjà enregistré'};
  }
  const savedBySession=new Map();   // séance -> l'appel existait-il déjà en base à l'ouverture ?
  function runtimeData(){try{return typeof data!=='undefined'?data:(root.data||{});}catch(_){return root.data||{};}}

  function rows(sheet){return [...sheet.querySelectorAll('table tbody tr')].filter(tr=>tr.querySelector('select.presence-select,input'));}

  function refresh(sheet){
    const doc=sheet.ownerDocument,all=rows(sheet);
    const c=counts(all.map(statusOf));
    const box=sheet.querySelector('.v50-count');
    if(box)box.innerHTML=[['present','Présents','g'],['absent','Absents','r'],['retard','Retards','o'],['justifie','Justifiés','b'],['total','Total','']]
      .map(([k,l,cl])=>`<div class="${cl}"><b>${c[k]}</b><span>${l}</span></div>`).join('');
    let shown=0;
    all.forEach(tr=>{const st=statusOf(tr);tr.dataset.v50Status=st;
      tr.querySelectorAll('.v50-seg button').forEach(b=>{const on=b.dataset.v=== st;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on?'true':'false');});
      const ok=visible({name:nameOf(tr),status:st,gradeEmpty:gradeEmpty(tr)},filter,query);tr.hidden=!ok;if(ok)shown++;});
    const empty=sheet.querySelector('.v50-empty');if(empty)empty.hidden=shown>0;
    sheet.querySelectorAll('.v50-chips button').forEach(b=>b.classList.toggle('on',b.dataset.f===filter));
    updateBar(sheet,false);
  }

  function updateBar(sheet,justSaved){
    const bar=sheet.querySelector('.v50-bar');if(!bar)return;
    const t=barText(changes(sheet),justSaved,!savedBySession.get(sessionId(sheet.ownerDocument)));
    bar.dataset.state=t.state;
    bar.querySelector('.v50-bar-t').textContent=t.title;
    bar.querySelector('.v50-bar-s').textContent=t.sub;
  }

  function setStatus(sheet,tr,value,withUndo){
    const sel=tr.querySelector('select.presence-select');if(!sel||sel.disabled)return;
    const before=sel.value;if(before===value)return;
    sel.value=value;sel.dispatchEvent(new Event('change',{bubbles:true}));
    if(sel.value!==value){refresh(sheet);return;}           // refus (séance verrouillée) : rien ne change
    try{root.navigator?.vibrate?.(value==='present'?6:12);}catch(_){}
    refresh(sheet);
    const id=tr.dataset.v50Id,doc=sheet.ownerDocument;
    if(withUndo)snack(sheet,`${nameOf(tr)||'Étudiant'} → ${LABEL[value]}`,()=>{
      // La feuille a pu être redessinée : on retrouve la ligne affichée par son identifiant.
      const live=doc.getElementById('presence-sheet')||sheet,row=[...live.querySelectorAll('tr[data-v50-id]')].find(r=>r.dataset.v50Id===id)||tr;
      setStatus(live,row,before,false);});
  }

  function snack(sheet,text,undo){
    const doc=sheet.ownerDocument;let s=doc.getElementById('v50-snack');
    if(!s){s=doc.createElement('div');s.id='v50-snack';s.setAttribute('role','status');s.innerHTML='<span></span><button type="button">ANNULER</button>';doc.body.appendChild(s);}
    s.querySelector('span').textContent=text;
    s.querySelector('button').onclick=()=>{hide();undo();};
    s.classList.add('show');
    function hide(){s.classList.remove('show');}
    clearTimeout(undoTimer);undoTimer=setTimeout(hide,4500);
  }

  async function save(sheet,btn){
    const doc=sheet.ownerDocument,fn=root.saveAttendance;if(typeof fn!=='function')return;
    btn.disabled=true;btn.textContent='Enregistrement…';
    let ok=false;try{ok=await fn(true);}catch(_){ok=false;}
    const live=doc.getElementById('presence-sheet');
    if(ok!==false){savedBySession.set(sessionId(doc),true);dirtySet(doc).clear();const live0=doc.getElementById('presence-sheet')||sheet,om=origMap(doc);rows(live0).forEach(tr=>om.set(tr.dataset.v50Id,statusOf(tr)));try{root.navigator?.vibrate?.([10,40,10]);}catch(_){}}
    // La feuille a pu être redessinée pendant l'enregistrement : on met à jour celle qui est affichée.
    const target=live?.querySelector('.v50-bar')?live:sheet;
    const b=target.querySelector('.v50-bar button');if(b){b.disabled=false;b.textContent='Enregistrer';}
    updateBar(target,ok!==false);
  }

  function enhance(sheet){
    const table=sheet.querySelector('table');if(!table||table.dataset.v50)return false;
    const all=rows(sheet);if(!all.some(tr=>tr.querySelector('select.presence-select')))return false;
    table.dataset.v50='1';sheet.classList.add('v50-appel');table.classList.add('v50-table');
    const doc=sheet.ownerDocument,dirty=dirtySet(doc),om=origMap(doc),sid=sessionId(doc);
    if(!savedBySession.has(sid))savedBySession.set(sid,(runtimeData().attendance||[]).some(a=>String(a.sessionId)===String(sid)&&!a.gradeOnly));
    all.forEach((tr,i)=>{
      tr.dataset.v50Id=rowKey(tr,i);
      if(!om.has(tr.dataset.v50Id))om.set(tr.dataset.v50Id,statusOf(tr));
      const sel=tr.querySelector('select.presence-select');if(!sel)return;
      sel.tabIndex=-1;sel.setAttribute('aria-hidden','true');
      const seg=doc.createElement('div');seg.className='v50-seg';seg.setAttribute('role','group');seg.setAttribute('aria-label','Présence de '+nameOf(tr));
      seg.innerHTML=STATUSES.map(([v,s,l])=>`<button type="button" data-v="${v}" title="${l}" aria-label="${l}" ${sel.disabled?'disabled':''}>${s}</button>`).join('');
      seg.addEventListener('click',e=>{const b=e.target.closest('button[data-v]');if(b)setStatus(sheet,tr,b.dataset.v,true);});
      sel.after(seg);
      const g=tr.querySelector('input[type="number"]');if(g&&(!g.placeholder||g.placeholder==='—'))g.placeholder='Note /20';
      tr.querySelectorAll('input').forEach(inp=>inp.addEventListener('change',()=>{dirty.add(tr.dataset.v50Id);refresh(sheet);}));
    });
    const wrap=table.closest('.table-responsive')||table;
    const tools=doc.createElement('div');tools.className='v50-tools';
    tools.innerHTML='<div class="v50-count" aria-live="polite"></div>'
      +'<div class="v50-chips">'+[['all','Tous'],['absent','Absents'],['retard','Retards'],['nograde','Sans note']].map(([f,l])=>`<button type="button" data-f="${f}">${l}</button>`).join('')+'</div>'
      +'<input type="search" class="v50-search" placeholder="Rechercher un étudiant" aria-label="Rechercher un étudiant">'
      +'<p class="v50-hint">Tout le monde est présent par défaut · touchez A, R ou J pour les autres.</p>';
    wrap.before(tools);
    const empty=doc.createElement('p');empty.className='v50-empty';empty.hidden=true;empty.textContent='Aucun étudiant pour ce filtre.';wrap.after(empty);
    tools.querySelector('.v50-chips').addEventListener('click',e=>{const b=e.target.closest('button[data-f]');if(b){filter=b.dataset.f;refresh(sheet);}});
    const search=tools.querySelector('.v50-search');search.value=query;search.addEventListener('input',()=>{query=search.value;refresh(sheet);});
    // Barre d'enregistrement fixe (remplace visuellement le bouton « Enregistrer » d'origine).
    const original=[...sheet.querySelectorAll('button')].find(b=>/saveAttendance\s*\(/.test(b.getAttribute('onclick')||''));
    if(original){
      original.classList.add('v50-orig-save');
      const bar=doc.createElement('div');bar.className='v50-bar';
      bar.innerHTML='<div class="v50-bar-st"><b><i class="v50-dot"></i><span class="v50-bar-t"></span></b><small class="v50-bar-s"></small></div><button type="button">Enregistrer</button>';
      bar.querySelector('button').addEventListener('click',()=>save(sheet,bar.querySelector('button')));
      sheet.appendChild(bar);
    }
    refresh(sheet);
    return true;
  }

  function boot(doc){
    const sheet=doc.getElementById('presence-sheet');if(!sheet||sheet.dataset.v50Watch)return;
    sheet.dataset.v50Watch='1';
    let t=null;new root.MutationObserver(()=>{clearTimeout(t);t=setTimeout(()=>enhance(sheet),30);}).observe(sheet,{childList:true,subtree:true});
    enhance(sheet);
    root.addEventListener?.('beforeunload',e=>{const sh=doc.getElementById('presence-sheet');if(sh?.querySelector('.v50-bar')&&changes(sh)){e.preventDefault();e.returnValue='';}});
  }

  const api={counts,visible,barText,changedCount,enhance};
  root.V50Appel=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root.document){
    if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>boot(root.document));
    else boot(root.document);
  }
})(typeof window!=='undefined'?window:globalThis);
