/* V55 — Économie de bande passante (quota Supabase).
 *
 * 1. Rien quand personne ne regarde : onglet caché plus d'une minute → le temps réel et les vérifications
 *    s'arrêtent ; au retour, une seule mise à jour, tout de suite. Après 2 h sans aucune action, la session
 *    se ferme d'elle-même (utile sur un ordinateur partagé).
 * 2. Seulement ce qui a changé : la première lecture d'une table (présences, étudiants, séances, classes,
 *    inscriptions, groupes) est complète ; les suivantes ne demandent que les lignes modifiées depuis
 *    (updated_at), et l'application les fusionne. Une lecture complète est refaite toutes les 10 minutes et
 *    après toute suppression, pour ne jamais garder une ligne disparue.
 *    Au passage : une lecture complète va maintenant au-delà de 1 000 lignes (le serveur coupait à 1 000 ;
 *    le site ne voyait que 1 000 des 1 162 présences).
 */
(function(root){
  'use strict';
  if(root.V55Economie)return;
  const TABLES=new Set(['attendance','students','sessions','classes','enrollments','student_groups']);
  const PAGE=1000, FULL_EVERY=10*60*1000, OVERLAP=2*60*1000;
  const HIDDEN_PAUSE=60*1000, IDLE_LOGOUT=2*60*60*1000;

  /* ---------- 2. Lectures différentielles ---------- */

  /* Fusion d'une lecture différentielle dans le résultat gardé (fonction pure, testée).
     rows : lignes gardées ; delta : lignes modifiées (y compris supprimées) ; wantDeleted : la requête
     d'origine filtrait deleted_at=is.null ; order : [[colonne, 'asc'|'desc'], …] de la requête d'origine. */
  function merge(rows,delta,wantDeleted,order){
    const byId=new Map(rows.map(r=>[String(r.id),r]));
    for(const r of delta){
      const id=String(r.id);
      if(wantDeleted&&r.deleted_at!=null)byId.delete(id);else byId.set(id,r);
    }
    const out=[...byId.values()];
    if(order&&order.length)out.sort((a,b)=>{for(const [c,dir] of order){const x=a[c],y=b[c];if(x===y)continue;if(x==null)return 1;if(y==null)return -1;const s=x<y?-1:1;return dir==='desc'?-s:s;}return 0;});
    return out;
  }
  /* Date la plus récente vue (updated_at), en ISO. */
  function newest(rows){let m='';for(const r of rows){const u=r&&r.updated_at;if(u&&String(u)>m)m=String(u);}return m;}
  /* « order=a.asc,b.desc » → [['a','asc'],['b','desc']] ; null si la requête est trop particulière pour être fusionnée. */
  function parseOrder(v){
    if(!v)return [];
    const out=[];for(const part of String(v).split(',')){const [c,dir='asc',...rest]=part.split('.');if(rest.length||!/^[a-z_]+$/.test(c)||!/^(asc|desc)$/.test(dir))return null;out.push([c,dir]);}
    return out;
  }
  /* La lecture peut-elle être gardée et complétée ? (pas de limite, pas de comptage, pas de colonnes
     choisies sans id/updated_at/deleted_at). */
  function eligible(f){
    try{
      if(!f||!f.url||f.method!=='GET')return false;
      const p=f.url.searchParams;
      if(p.has('limit')||p.has('offset'))return false;
      const prefer=f.headers&&(typeof f.headers.get==='function'?f.headers.get('Prefer'):f.headers.Prefer);
      if(prefer&&/count=/.test(prefer))return false;
      const accept=f.headers&&(typeof f.headers.get==='function'?f.headers.get('Accept'):f.headers.Accept);
      if(accept&&/object/.test(accept))return false;
      const sel=p.get('select')||'*';
      if(sel!=='*'&&!(/(^|,)id(,|$)/.test(sel)&&/updated_at/.test(sel)))return false;
      if(parseOrder(p.get('order'))===null)return false;
      return true;
    }catch(_){return false;}
  }

  const cache=new Map();   // clé (compte + requête) → {rows, full: horodatage, wantDeleted, order}
  const dirty=new Set();   // tables à relire en entier (après une suppression ou une écriture de ce poste)
  function who(){try{return (typeof currentTeacher!=='undefined'?currentTeacher:root.currentTeacher)?.id||'';}catch(_){return '';}}

  async function readAll(f,then){
    // Lecture complète, page par page (le serveur s'arrête à 1 000 lignes par réponse).
    let all=[],from=0,last=null;
    const addedOrder=!f.url.searchParams.has('order');
    if(addedOrder)f.url.searchParams.set('order','id.asc');   // pages stables d'une réponse à l'autre
    for(;;){
      f.url.searchParams.set('offset',String(from));f.url.searchParams.set('limit',String(PAGE));
      const res=await then.call(f,x=>x);
      last=res;if(res.error||!Array.isArray(res.data)){f.url.searchParams.delete('offset');f.url.searchParams.delete('limit');if(addedOrder)f.url.searchParams.delete('order');return res;}
      all=all.concat(res.data);
      if(res.data.length<PAGE)break;
      from+=PAGE;if(from>200000)break;
    }
    f.url.searchParams.delete('offset');f.url.searchParams.delete('limit');if(addedOrder)f.url.searchParams.delete('order');
    return Object.assign({},last,{data:all,count:null});
  }

  function wrapClient(client){
    if(!client||client.__v55)return client;
    const from=client.from.bind(client);
    client.from=function(table){
      const qb=from(table);
      if(!TABLES.has(table)||!qb)return qb;
      // Toute écriture de ce poste sur la table : prochaine lecture complète (les suppressions ne laissent pas de trace).
      for(const m of ['insert','update','upsert','delete']){
        if(typeof qb[m]!=='function')continue;
        const orig=qb[m].bind(qb);qb[m]=function(){if(m==='delete')dirty.add(table);return orig.apply(qb,arguments);};
      }
      if(typeof qb.select!=='function')return qb;
      const select=qb.select.bind(qb);
      qb.select=function(){
        const f=select.apply(qb,arguments);
        if(!f||typeof f.then!=='function')return f;
        const then=f.then.bind(f);
        f.then=function(ok,ko){
          const run=async()=>{
            if(!eligible(f))return then(x=>x);
            const p=f.url.searchParams,order=parseOrder(p.get('order'))||[];
            const wantDeleted=p.get('deleted_at')==='is.null';
            const base=new URL(f.url.toString());base.searchParams.delete('offset');base.searchParams.delete('limit');
            const key=who()+'|'+table+'|'+base.toString();
            const c=cache.get(key);
            if(c&&!dirty.has(table)&&Date.now()-c.full<FULL_EVERY&&c.since){
              // Seulement ce qui a changé depuis la dernière lecture (avec 2 min de marge).
              const since=new Date(Date.parse(c.since)-OVERLAP).toISOString();
              if(wantDeleted)p.delete('deleted_at');
              p.append('updated_at','gte.'+since);
              const res=await readAll(f,then);
              if(res.error||!Array.isArray(res.data)){cache.delete(key);return res;}
              c.rows=merge(c.rows,res.data,wantDeleted,order);
              const n=newest(res.data);if(n>c.since)c.since=n;
              return Object.assign({},res,{data:c.rows.slice()});
            }
            const res=await readAll(f,then);
            if(!res.error&&Array.isArray(res.data)){
              cache.set(key,{rows:res.data.slice(),full:Date.now(),since:newest(res.data),wantDeleted,order});
              dirty.delete(table);
            }
            return res;
          };
          return run().then(ok,ko);
        };
        return f;
      };
      return qb;
    };
    client.__v55=true;return client;
  }

  /* ---------- 1. Rien quand personne ne regarde ---------- */
  let hiddenTimer=null,paused=false,lastActive=Date.now();
  function rt(){return root.FSTOnlineRuntime;}
  function pause(){
    if(paused||!root.document.hidden)return;
    paused=true;try{rt()?.stopRealtime?.();}catch(_){}
  }
  async function resume(){
    if(!paused)return;paused=false;
    try{if(await rt()?.refreshAuthoritativeState?.())rt()?.startRealtime?.();}catch(_){}
  }
  function onVisibility(){
    clearTimeout(hiddenTimer);
    if(root.document.hidden)hiddenTimer=setTimeout(pause,HIDDEN_PAUSE);
    else{checkIdle();void resume();}
  }
  function signedIn(){try{return Boolean(typeof currentTeacher!=='undefined'?currentTeacher:root.currentTeacher);}catch(_){return false;}}
  function checkIdle(){
    if(!signedIn())return;
    if(Date.now()-lastActive<IDLE_LOGOUT)return;
    // Jamais pendant un appel non enregistré.
    if(root.document.querySelector('.v50-bar[data-state="dirty"]')){lastActive=Date.now()-IDLE_LOGOUT+15*60*1000;return;}
    // 2 h sans aucune action : on ferme la session (et donc toute lecture).
    try{rt()?.stopRealtime?.();}catch(_){}
    try{sessionStorage.setItem('fst_idle_logout','1');}catch(_){}
    try{if(typeof root.logoutTeacher==='function')root.logoutTeacher();else root.supabaseClient?.auth?.signOut?.();}catch(_){}
    lastActive=Date.now();
  }
  function patchPolling(){
    // Vérification du mode (toutes les 15 s) : pas quand l'onglet est caché.
    const R=root.V18RuntimeMode;
    if(R&&!R.__v55&&typeof R.refresh==='function'){const orig=R.refresh.bind(R);R.refresh=function(){if(root.document.hidden)return Promise.resolve(R.mode);return orig();};R.__v55=true;}
  }

  if(root.supabaseClient)wrapClient(root.supabaseClient);
  root.V55Economie={merge,newest,parseOrder,eligible,wrapClient,_cache:cache};
  if(typeof module!=='undefined'&&module.exports)module.exports={merge,newest,parseOrder,eligible};
  if(root.document&&root.addEventListener){
    root.document.addEventListener('visibilitychange',onVisibility);
    for(const ev of ['pointerdown','keydown','touchstart','wheel'])root.addEventListener(ev,()=>{lastActive=Date.now();},{passive:true,capture:true});
    setInterval(()=>{checkIdle();patchPolling();},60000);
    patchPolling();
  }
})(typeof window!=='undefined'?window:globalThis);
