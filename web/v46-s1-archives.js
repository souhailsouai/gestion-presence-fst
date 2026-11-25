/* V46 — Fin du S1 : à partir du 12/12/2026, le S1 disparaît du site pour tout le monde.
   Les séances et le planning datés d'avant le 12/12/2026 ne sont plus chargés ; le planning S1, LPC3
   et le sélecteur S1/S2 sont masqués. Un administrateur affiche le S1 avec « Archives S1 »
   (onglet Administration) : la page se recharge et tout le S1 réapparaît, avec un bandeau. */
(function(root){
  'use strict';
  if(root.V46S1Archives)return;
  const HIDE_FROM='2026-12-12';
  const KEY='fst_s1_archives';
  const DATE_COL={sessions:'session_date',session_plans:'plan_date'};
  const pad=n=>String(n).padStart(2,'0');
  const today=()=>{if(root.V46_TODAY)return root.V46_TODAY;const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
  function me(){try{return typeof currentTeacher!=='undefined'?currentTeacher:root.currentTeacher;}catch(_){return root.currentTeacher||null;}}
  const archiveOn=()=>{try{return root.sessionStorage.getItem(KEY)==='1';}catch(_){return false;}};
  /* Archives : seulement pour un administrateur. */
  const hidden=()=>today()>=HIDE_FROM&&!(archiveOn()&&me()?.isAdmin);

  /* Filtre posé sur toute lecture des séances et du planning (fonction pure, testée sous Node). */
  function wrapClient(client){
    if(!client||client.__v46)return client;
    const from=client.from.bind(client);
    client.from=function(table){
      const qb=from(table);const col=DATE_COL[table];
      if(!col||!qb||typeof qb.select!=='function')return qb;
      const select=qb.select.bind(qb);
      qb.select=function(){const f=select.apply(qb,arguments);return hidden()&&f&&typeof f.gte==='function'?f.gte(col,HIDE_FROM):f;};
      return qb;
    };
    client.__v46=true;return client;
  }

  function apply(){
    const doc=root.document;if(!doc?.body)return;
    const h=hidden();
    doc.body.dataset.s1Hidden=h?'1':'0';
    if(h&&root.V33Semester?.get?.()==='S1')root.V33Semester.set('S2');
    banner();adminCard();
  }
  function banner(){
    const doc=root.document;let b=doc.getElementById('v46-banner');
    const show=today()>=HIDE_FROM&&archiveOn()&&me()?.isAdmin;
    if(!show){b?.remove();return;}
    if(b)return;
    b=doc.createElement('div');b.id='v46-banner';b.className='v46-banner';b.setAttribute('role','status');
    b.innerHTML='<i class="fas fa-box-archive"></i> <b>Archives S1 affichées</b> — le S1 est visible pour vous seulement. <button type="button" class="btn btn-sm" data-v46-off>Masquer le S1</button>';
    b.querySelector('[data-v46-off]').onclick=()=>setArchive(false);
    (doc.querySelector('.main-content')||doc.body).prepend(b);
  }
  function adminCard(){
    const doc=root.document,host=doc.getElementById('administration');
    if(!host||today()<HIDE_FROM){doc.getElementById('v46-admin')?.remove();return;}
    const on=archiveOn();let c=doc.getElementById('v46-admin');
    if(!c){c=doc.createElement('section');c.id='v46-admin';c.className='v46-admin';host.prepend(c);}
    c.innerHTML=`<h3><i class="fas fa-box-archive"></i> Archives S1</h3><p>${on?'Le S1 est affiché (archives) : séances, présences, planning S1, LPC3 et Bilan S1.':'Le S1 est terminé : il est masqué partout. Affichez-le pour consulter ou corriger une séance du S1, ou générer le Bilan S1.'}</p>
      <button type="button" class="btn ${on?'btn-primary':'btn-warning'}" data-v46-toggle>${on?'Masquer le S1':'Afficher le S1 (archives)'}</button>`;
    c.querySelector('[data-v46-toggle]').onclick=()=>setArchive(!on);
  }
  function setArchive(on){
    try{if(on)root.sessionStorage.setItem(KEY,'1');else root.sessionStorage.removeItem(KEY);}catch(_){}
    root.location.reload();
  }

  if(root.supabaseClient)wrapClient(root.supabaseClient);
  if(root.document){
    const start=()=>{apply();setInterval(apply,4000);};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
    root.addEventListener('v16:role-changed',apply);
  }
  root.V46S1Archives={wrapClient,hidden,HIDE_FROM,apply};
  if(typeof module!=='undefined')module.exports={wrapClient,HIDE_FROM,_set:(o)=>Object.assign(root,o)};
})(typeof window!=='undefined'?window:globalThis);
