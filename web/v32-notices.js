/* V32 — Avis officiels modifiables par l'administrateur.
   Les avis sont lus dans la table public.app_notices. Si la table n'existe pas
   encore ou est vide, les avis d'origine restent affichés tels quels. */
(function(root){
  'use strict';
  const client=()=>typeof supabaseClient!=='undefined'?supabaseClient:root.supabaseClient;
  const teacher=()=>typeof currentTeacher!=='undefined'?currentTeacher:root.currentTeacher;
  const isAdmin=()=>{const t=teacher();return !!(t&&t.isAdmin&&t.activeMode==='admin');};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const format=body=>esc(body).split('\n').map(l=>l.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')).join('<br>');
  let notices=null,loadedFor=null,loading=false;

  async function load(force){
    const c=client(),t=teacher();
    if(!c||!t||loading)return;
    if(!force&&loadedFor===t.id+':'+t.activeMode)return;
    loading=true;
    try{
      const {data,error}=await c.from('app_notices').select('id,title,body,position,published,updated_at').order('position').order('updated_at');
      notices=error?null:(data||[]);
      loadedFor=t.id+':'+t.activeMode;
    }catch(e){notices=null;}
    finally{loading=false;}
    render();
  }

  function render(){
    const dash=document.getElementById('dashboard');
    if(!dash)return;
    let host=document.getElementById('v32-notices');
    const legacy=[document.getElementById('v21-official-notices'),dash.querySelector('[data-v16-dashboard-notices="true"]')];
    if(notices===null){ if(host)host.remove(); legacy.forEach(n=>n&&(n.style.display='')); return; }
    const visible=notices.filter(n=>n.published||isAdmin());
    if(!visible.length&&!isAdmin()){ if(host)host.remove(); legacy.forEach(n=>n&&(n.style.display='')); return; }
    legacy.forEach(n=>n&&(n.style.display='none'));
    if(!host){host=document.createElement('section');host.id='v32-notices';host.className='card v32-notices';
      const anchor=document.getElementById('v21-official-notices');
      if(anchor)anchor.insertAdjacentElement('beforebegin',host);else dash.appendChild(host);}
    host.innerHTML=`<div class="v32-notices-head"><h3><i class="fas fa-bullhorn"></i> Avis officiels</h3>${isAdmin()?'<button type="button" class="btn btn-primary btn-sm" data-v32-edit-notices><i class="fas fa-pen"></i> Modifier les avis</button>':''}</div>
      <div class="v32-notices-grid">${visible.map(n=>`<article class="v32-notice${n.published?'':' is-hidden'}"><h4>${esc(n.title)}${n.published?'':' <span class="badge badge-warning">masqué</span>'}</h4><div class="v32-notice-body">${format(n.body)}</div></article>`).join('')||'<p class="v32-muted">Aucun avis pour le moment.</p>'}</div>`;
    host.querySelector('[data-v32-edit-notices]')?.addEventListener('click',openEditor);
  }

  function rowHtml(n,i){
    return `<div class="v32-edit-row" data-id="${esc(n.id||'')}">
      <div class="v32-edit-top"><input type="text" class="form-control" data-f="title" maxlength="200" value="${esc(n.title)}" placeholder="Titre de l'avis">
      <label class="v32-check"><input type="checkbox" data-f="published" ${n.published!==false?'checked':''}> Visible</label>
      <button type="button" class="btn btn-sm btn-info" data-act="up" title="Monter" ${i===0?'disabled':''}>↑</button>
      <button type="button" class="btn btn-sm btn-info" data-act="down" title="Descendre">↓</button>
      <button type="button" class="btn btn-sm btn-danger" data-act="del" title="Supprimer"><i class="fas fa-trash"></i></button></div>
      <textarea class="form-control" data-f="body" rows="5" maxlength="5000" placeholder="Texte de l'avis">${esc(n.body)}</textarea></div>`;
  }

  function openEditor(){
    if(!isAdmin())return;
    let draft=(notices||[]).map(n=>({...n})),removed=[];
    const wrap=document.createElement('div');wrap.className='v32-modal';wrap.setAttribute('role','dialog');wrap.setAttribute('aria-modal','true');
    const collect=()=>{wrap.querySelectorAll('.v32-edit-row').forEach((r,i)=>{draft[i].title=r.querySelector('[data-f=title]').value;draft[i].body=r.querySelector('[data-f=body]').value;draft[i].published=r.querySelector('[data-f=published]').checked;});};
    const paint=()=>{wrap.querySelector('.v32-edit-list').innerHTML=draft.map(rowHtml).join('')||'<p class="v32-muted">Aucun avis. Cliquez sur « Ajouter un avis ».</p>';};
    wrap.innerHTML=`<div class="v32-modal-box"><div class="v32-modal-head"><h3>Modifier les avis officiels</h3><button type="button" class="v32-close" data-act="close" aria-label="Fermer">×</button></div>
      <p class="v32-muted">Écrivez le texte simplement. Chaque ligne s'affiche sur une nouvelle ligne. Mettez un mot entre <strong>**deux étoiles**</strong> pour l'écrire en gras.</p>
      <div class="v32-edit-list"></div>
      <div class="v32-modal-actions"><button type="button" class="btn btn-info" data-act="add"><i class="fas fa-plus"></i> Ajouter un avis</button><span style="flex:1"></span><button type="button" class="btn btn-info" data-act="close">Annuler</button><button type="button" class="btn btn-primary" data-act="save"><i class="fas fa-check"></i> Enregistrer</button></div></div>`;
    document.body.appendChild(wrap);paint();
    wrap.addEventListener('click',async ev=>{
      const b=ev.target.closest('[data-act]');if(!b)return;const act=b.dataset.act;
      if(act==='close'){wrap.remove();return;}
      collect();
      const idx=[...wrap.querySelectorAll('.v32-edit-row')].indexOf(b.closest('.v32-edit-row'));
      if(act==='add'){draft.push({title:'',body:'',published:true});paint();wrap.querySelector('.v32-edit-row:last-child [data-f=title]')?.focus();return;}
      if(act==='del'&&idx>=0){if(!confirm('Supprimer cet avis ?'))return;const [r]=draft.splice(idx,1);if(r.id)removed.push(r.id);paint();return;}
      if(act==='up'&&idx>0){[draft[idx-1],draft[idx]]=[draft[idx],draft[idx-1]];paint();return;}
      if(act==='down'&&idx>=0&&idx<draft.length-1){[draft[idx+1],draft[idx]]=[draft[idx],draft[idx+1]];paint();return;}
      if(act==='save'){
        if(draft.some(d=>!d.title.trim())){root.showAlert?.('Chaque avis doit avoir un titre.','danger');return;}
        b.disabled=true;
        try{
          const c=client();
          for(const id of removed){const {error}=await c.from('app_notices').delete().eq('id',id);if(error)throw error;}
          const rows=draft.map((d,i)=>({...(d.id?{id:d.id}:{}),title:d.title.trim(),body:d.body,published:d.published!==false,position:i+1}));
          const existing=rows.filter(r=>r.id),fresh=rows.filter(r=>!r.id);
          if(existing.length){const {error}=await c.from('app_notices').upsert(existing);if(error)throw error;}
          if(fresh.length){const {error}=await c.from('app_notices').insert(fresh);if(error)throw error;}
          wrap.remove();root.showAlert?.('Avis enregistrés. Tous les enseignants voient la nouvelle version.','success');
          await load(true);
        }catch(e){b.disabled=false;root.showAlert?.('Enregistrement impossible : '+(e.message||e),'danger');}
      }
    });
  }

  function tick(){
    const t=teacher();
    if(!t||!document.body.classList.contains('app-active')){loadedFor=null;return;}
    if(loadedFor!==t.id+':'+t.activeMode)load(false);
    else if(!document.getElementById('v32-notices')&&notices&&notices.length)render();
  }
  setInterval(tick,1500);
  root.V32Notices={load,render,format};
})(typeof globalThis!=='undefined'?globalThis:this);
