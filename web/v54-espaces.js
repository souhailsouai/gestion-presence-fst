/* V54 — Une section par espace, comme LPC3.
 * MPI1 · PC1 reste la section principale ; LPHE1, LPC1… ont chacune leur entrée « Espaces » dans le menu.
 * Dans une section, tout le site (Présence, Séances, Étudiants, Classes, Rapports, Semestres S2, « Maintenant »)
 * ne montre que les classes de cet espace : rien de LPHE1 sous MPI1 · PC1, et inversement.
 * Le choix est gardé pour l'onglet du navigateur ; changer de section recharge la page.
 */
(function(root){
  'use strict';
  if(root.V54Espaces)return;
  const DEF='00000000-0000-4000-8000-000000000001';
  const KEY='fst_section';
  const TABLES={classes:'id',students:'class_id',sessions:'class_id',session_plans:'class_id',attendance:'session_id'};

  function section(){try{return root.sessionStorage.getItem(KEY)||DEF;}catch(_){return DEF;}}
  function me(){try{return typeof currentTeacher!=='undefined'?currentTeacher:root.currentTeacher;}catch(_){return root.currentTeacher||null;}}

  /* Une ligne appartient-elle à la section ? (fonction pure, testée sous Node)
     classSpace : classe → espace ; sessionClass : séance → classe. Une classe sans espace = MPI1 · PC1. */
  function keep(table,row,sec,classSpace,sessionClass){
    const key=TABLES[table];if(!key||!row)return true;
    let cls=row[key];
    if(table==='attendance'){cls=sessionClass.get(String(row.session_id));if(cls===undefined)return true;}
    if(cls===undefined||cls===null)return true;
    const sp=classSpace.get(String(cls));
    if(sp===undefined)return true;              // classe inconnue : on ne cache rien par erreur
    return (sp||DEF)===sec;
  }

  /* Index des classes et séances des autres espaces (lus une fois, sans filtre). */
  let index=null,indexAt=0;
  async function loadIndex(raw){
    if(index&&Date.now()-indexAt<60000)return index;
    const c=raw();
    const cls=await c.from('classes').select('id,space_id');
    const classSpace=new Map((cls.data||[]).map(x=>[String(x.id),x.space_id||DEF]));
    const sessionClass=index?.sessionClass||new Map();
    const others=[...classSpace].filter(([,sp])=>sp!==DEF).map(([id])=>id);
    // Rien hors de MPI1 · PC1 et section principale : aucun filtre à poser.
    const active=others.length>0||section()!==DEF;
    if(active){
      for(let from=0;;from+=1000){
        const r=await c.from('sessions').select('id,class_id').range(from,from+999);
        (r.data||[]).forEach(s=>sessionClass.set(String(s.id),String(s.class_id)));
        if(!r.data||r.data.length<1000)break;
      }
    }
    index={classSpace,sessionClass,active};indexAt=Date.now();
    return index;
  }

  /* Pose le filtre sur les lectures des tables génériques. Une lecture qui demande « space_id » n'est pas filtrée
     (c'est le module Semestres qui lit lui-même l'espace qu'il affiche). */
  function wrapClient(client){
    if(!client||client.__v54)return client;
    const from=client.from.bind(client);
    const raw=()=>({from});
    client.fromAll=from;
    client.from=function(table){
      const qb=from(table);
      if(!TABLES[table]||!qb||typeof qb.select!=='function')return qb;
      const select=qb.select.bind(qb);
      qb.select=function(cols){
        const f=select.apply(qb,arguments);
        if(!f||typeof f.then!=='function'||/space_id/.test(String(cols||'')))return f;
        const then=f.then.bind(f);
        f.then=function(ok,ko){
          return then(async res=>{
            try{
              if(res&&Array.isArray(res.data)&&res.data.length){
                const ix=await loadIndex(raw);
                // Toute lecture de séances tient l'index à jour (une séance ouverte à l'instant est reconnue).
                if(table==='sessions')res.data.forEach(r=>{if(r&&r.id&&r.class_id)ix.sessionClass.set(String(r.id),String(r.class_id));});
                if(ix.active){const sec=section();res.data=res.data.filter(r=>keep(table,r,sec,ix.classSpace,ix.sessionClass));}
              }
            }catch(_){/* en cas de doute, on n'enlève rien */}
            return res;
          }).then(ok,ko);
        };
        return f;
      };
      return qb;
    };
    client.__v54=true;return client;
  }

  /* Menu : groupe « Espaces » (MPI1 · PC1 + mes autres espaces) et bandeau de section. */
  let spaces=null;
  async function mySpaces(){
    const c=root.supabaseClient,t=me();if(!c||!t)return [];
    const from=c.fromAll||c.from.bind(c);
    const [sp,mem,perm,sup]=await Promise.all([
      from('spaces').select('id,name').order('created_at'),
      from('space_members').select('space_id').eq('profile_id',t.id),
      from('space_permissions').select('space_id').eq('profile_id',t.id),
      c.rpc('v45_am_super_admin').then(r=>r.data===true).catch(()=>false)
    ]);
    const ids=new Set([...(mem.data||[]).map(x=>x.space_id),...(perm.data||[]).map(x=>x.space_id)]);
    if(t.isAdmin)ids.add(DEF);
    return (sp.data||[]).filter(x=>sup||ids.has(x.id));
  }
  function go(id){
    try{if(id===DEF)root.sessionStorage.removeItem(KEY);else root.sessionStorage.setItem(KEY,id);root.sessionStorage.setItem('fst_section_open','1');}catch(_){}
    root.location.reload();
  }
  function navButton(sp,on){
    const b=root.document.createElement('button');
    b.type='button';b.className='nav-tab fst-nav-item'+(on?' active':'');b.dataset.v54Space=sp.id;b.title=sp.name;b.setAttribute('aria-label','Section '+sp.name);
    if(on)b.setAttribute('aria-current','true');
    b.innerHTML='<svg class="fst-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 12l9 4 9-4"/><path d="M3 17l9 4 9-4"/></svg><span class="fst-nav-label"></span>';
    b.querySelector('.fst-nav-label').textContent=sp.name;
    b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(sp.id!==section())go(sp.id);else root.switchTab?.('semestres');});
    return b;
  }
  function renderNav(){
    const doc=root.document,nav=doc.getElementById('fst-sidebar-nav');if(!nav||!spaces)return;
    let g=doc.getElementById('v54-espaces');
    if(spaces.length<2){g?.remove();return;}
    if(!g){
      g=doc.createElement('section');g.id='v54-espaces';g.className='fst-nav-group';
      const admin=[...nav.querySelectorAll('.fst-nav-group')].find(x=>/Administration/.test(x.querySelector('.fst-nav-group-label')?.textContent||''));
      nav.insertBefore(g,admin||null);
    }
    const sec=section();
    g.innerHTML='<h2 class="fst-nav-group-label">Espaces</h2>';
    spaces.forEach(sp=>g.appendChild(navButton(sp,sp.id===sec)));
    g.hidden=false;
  }
  function renderBanner(){
    const doc=root.document,sec=section();let b=doc.getElementById('v54-banner');
    if(sec===DEF||!spaces){b?.remove();return;}
    const name=spaces.find(x=>x.id===sec)?.name||'Espace';
    if(!b){b=doc.createElement('div');b.id='v54-banner';b.className='v54-banner';b.setAttribute('role','status');(doc.querySelector('.main-content')||doc.getElementById('fst-main')||doc.body).prepend(b);}
    b.innerHTML='<span><b></b> — Présence, Séances, Étudiants, Classes et Semestres n’affichent que cet espace.</span><button type="button" class="btn btn-sm">Revenir à MPI1 · PC1</button>';
    b.querySelector('b').textContent='Section '+name;
    b.querySelector('button').onclick=()=>go(DEF);
  }
  async function refresh(){
    if(!me())return;
    try{spaces=await mySpaces();}catch(_){spaces=[];}
    // Section qui n'est plus accessible (droit retiré) : retour à MPI1 · PC1.
    if(section()!==DEF&&!spaces.some(x=>x.id===section())){go(DEF);return;}
    renderNav();renderBanner();
    try{if(root.sessionStorage.getItem('fst_section_open')==='1'){root.sessionStorage.removeItem('fst_section_open');if(section()!==DEF)root.switchTab?.('semestres');}}catch(_){}
  }

  if(root.supabaseClient)wrapClient(root.supabaseClient);
  root.V54Espaces={section,keep,wrapClient,DEF,refresh};
  if(typeof module!=='undefined'&&module.exports)module.exports={keep,DEF};
  if(root.document){
    let last='';
    const tick=()=>{const t=me(),k=t?t.id+'|'+(t.activeMode||''):'';if(k&&k!==last){last=k;void refresh();}else if(k&&spaces&&!root.document.getElementById('v54-espaces')&&spaces.length>1)renderNav();};
    const start=()=>{tick();setInterval(tick,2500);};
    if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  }
})(typeof window!=='undefined'?window:globalThis);
