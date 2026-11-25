/* V44 — « Faire l'appel » depuis le planning S2, dans tous les espaces.
   Ajoute au menu des séances les cases S2 de l'enseignant (toutes pour un administrateur d'espace) :
   une case déjà ouverte pointe vers sa séance ; une case pas encore ouverte (« s2:<id> ») est ouverte
   par la fonction v44_s2_start_slot au moment de charger la feuille. */
(function(root){
  'use strict';
  if(root.V44S2Appel)return;
  const DEFAULT_SPACE='00000000-0000-4000-8000-000000000001';
  const S2_START='2027-01-11';
  const pad=n=>String(n).padStart(2,'0');
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
  const fmtDate=iso=>{const [y,m,d]=String(iso).split('-');return `${d}/${m}/${y}`;};
  const hm=t=>String(t||'').slice(0,5);
  function me(){try{return typeof currentTeacher!=='undefined'?currentTeacher:root.currentTeacher;}catch(_){return root.currentTeacher||null;}}

  /* Liste des options (fonction pure, testée sous Node). */
  function options(rows,ctx){
    const out=[];const now=ctx.today;
    for(const r of rows||[]){
      const s=r.session||r.v33_s2_sessions||{};if(!s.session_date||s.session_date<S2_START)continue;
      const mine=r.teacher_id===ctx.userId;const admin=ctx.isSuper||(ctx.adminSpaces||new Set()).has(r.space_id)||(ctx.isAdmin&&r.space_id===DEFAULT_SPACE);
      if(!mine&&!admin)continue;
      if(!r.attendance_session_id&&!admin&&s.session_date>now)continue; /* l'enseignant ouvre le jour même */
      const space=r.space_id!==DEFAULT_SPACE&&ctx.spaceNames?.get(r.space_id)?` [${ctx.spaceNames.get(r.space_id)}]`:'';
      out.push({value:r.attendance_session_id?String(r.attendance_session_id):`s2:${r.id}`,date:s.session_date,
        label:`S2 · ${fmtDate(s.session_date)} — ${s.class_name}-G${r.group_no} — ${r.manipulation_code||'—'} — ${r.room?'Salle '+r.room:'Salle —'} — ${hm(s.start_time)}–${hm(s.end_time)}${space}`});
    }
    return out.sort((a,b)=>a.date.localeCompare(b.date)||a.label.localeCompare(b.label,'fr'));
  }

  async function fetchRows(){
    const c=root.supabaseClient,t=me();if(!c||!t)return null;
    const uid=t.id;
    const [slots,mine,spaces]=await Promise.all([
      c.from('v33_s2_slots').select('id,space_id,group_no,manipulation_code,teacher_id,room,attendance_session_id,session:v33_s2_sessions!inner(session_date,start_time,end_time,class_name)').gte('session.session_date',S2_START),
      c.from('space_members').select('space_id,role').eq('profile_id',uid),
      c.from('spaces').select('id,name')
    ]);
    if(slots.error)throw slots.error;
    /* Mode administrateur : tout MPI1 · PC1 ; ailleurs, les espaces dont on est administrateur (le serveur revérifie). */
    return {rows:slots.data||[],ctx:{userId:uid,isAdmin:!!(t.isAdmin&&t.activeMode==='admin'),isSuper:false,today:today(),
      adminSpaces:new Set((mine.data||[]).filter(m=>m.role==='admin').map(m=>m.space_id)),
      spaceNames:new Map((spaces.data||[]).map(s=>[s.id,s.name]))}};
  }

  async function addOptions(){
    const select=document.getElementById('presence-session');if(!select||root.V18RuntimeMode?.getMode?.()==='demo')return;
    let got;try{got=await fetchRows();}catch(e){console.error('V44 S2',e);return;}
    if(!got)return;
    const existing=new Set([...select.options].map(o=>o.value));
    const opts=options(got.rows,got.ctx).filter(o=>!existing.has(o.value));
    if(!opts.length)return;
    const group=document.createElement('optgroup');group.label='Semestre 2 — planning';group.dataset.v44='1';
    for(const o of opts){const el=document.createElement('option');el.value=o.value;el.textContent=o.label;group.appendChild(el);}
    select.querySelectorAll('optgroup[data-v44]').forEach(g=>g.remove());
    select.appendChild(group);
  }

  const prevChoices=root.v17LoadOfficialSessionChoices;
  if(typeof prevChoices==='function'){
    const wrapped=async function(){const old=document.getElementById('presence-session')?.value;const r=await prevChoices.apply(this,arguments);await addOptions();const sel=document.getElementById('presence-session');if(sel&&old&&[...sel.options].some(o=>o.value===old))sel.value=old;return r;};
    root.v17LoadOfficialSessionChoices=wrapped;root.updatePresenceSelect=wrapped;
  }
  const prevLoad=root.loadPresenceSheet;
  root.loadPresenceSheet=async function(){
    const select=document.getElementById('presence-session');
    const value=select?.value||'';
    if(value.startsWith('s2:')){
      select.disabled=true;
      const {data:sessionId,error}=await root.supabaseClient.rpc('v44_s2_start_slot',{p_slot_id:value.slice(3)});
      if(error||!sessionId){select.disabled=false;(root.showAlert||alert)('Impossible d’ouvrir cette séance S2 : '+(error?.message||'séance non créée'),'danger');return false;}
      await root.FSTOnlineRuntime?.refreshAuthoritativeState?.();
      await root.v17LoadOfficialSessionChoices?.();
      if(![...select.options].some(o=>o.value===String(sessionId))){const o=document.createElement('option');o.value=String(sessionId);o.textContent='Séance S2 ouverte';select.appendChild(o);}
      select.value=String(sessionId);select.disabled=false;
    }
    return prevLoad?.apply(this,arguments);
  };
  root.V44S2Appel={options,addOptions};
  if(typeof module!=='undefined')module.exports={options};
})(typeof window!=='undefined'?window:globalThis);
