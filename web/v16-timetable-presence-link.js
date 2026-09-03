(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.V16TimetablePresenceLink=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';

  function esc(value){
    return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function runtimeData(){
    try{return typeof data!=='undefined'?data:(root.data||{classes:[],sessions:[]});}
    catch(_){return root.data||{classes:[],sessions:[]};}
  }
  function fmtDate(value){
    const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m?`${m[3]}/${m[2]}/${m[1]}`:String(value||'');
  }
  function weekday(value){
    const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m)return '—';
    const d=new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3])));
    return ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'][d.getUTCDay()];
  }
  function field(obj,...names){
    for(const name of names)if(obj&&obj[name]!=null)return obj[name];
    return null;
  }

  function openPresenceForSession(sessionId,options={}){
    const id=String(sessionId||'');
    if(!id)throw new Error('Séance invalide.');
    const switchFn=options.switchTab||root.switchTab;
    const updateFn=options.updatePresenceSelect||root.updatePresenceSelect;
    const loadFn=options.loadPresenceSheet||root.loadPresenceSheet;
    if(typeof switchFn!=='function')throw new Error('Navigation Présence indisponible.');

    switchFn('presence');
    if(typeof updateFn==='function')updateFn();

    const doc=options.document||root.document;
    const select=doc?.getElementById('presence-session');
    if(!select)throw new Error('Sélecteur de séance Présence introuvable.');
    select.value=String(sessionId);
    if(String(select.value)!==id)throw new Error('Cette séance n’est pas disponible dans Présence.');
    if(typeof loadFn!=='function')throw new Error('Chargement Présence indisponible.');
    loadFn();
    return true;
  }

  function renderTimetableSessions(options={}){
    const doc=options.document||root.document;
    const container=doc?.getElementById('emploi-content');
    if(!container)return false;
    const state=options.data||runtimeData();
    const classes=state.classes||[];
    const sessions=(state.sessions||[]).slice().sort((a,b)=>{
      const da=String(field(a,'date','session_date')||'');
      const db=String(field(b,'date','session_date')||'');
      return da.localeCompare(db)||String(field(a,'start','start_time')||'').localeCompare(String(field(b,'start','start_time')||''));
    });
    const classById=new Map(classes.map(c=>[String(c.id),c]));

    if(!sessions.length){
      container.innerHTML='<p style="color:#6c757d;">Aucune séance planifiée.</p>';
      return true;
    }

    const rows=sessions.map(session=>{
      const id=String(session.id);
      const classId=String(field(session,'classId','class_id')||'');
      const cls=classById.get(classId)||{};
      const date=field(session,'date','session_date')||'';
      const start=field(session,'start','start_time')||'';
      const end=field(session,'end','end_time')||'';
      const group=field(cls,'groupNumber','group_number');
      return `<tr data-v16-timetable-session="${esc(id)}">
        <td>${esc(fmtDate(date))}</td>
        <td>${esc(weekday(date))}</td>
        <td>${esc(`${start}${end?` - ${end}`:''}`)}</td>
        <td>${esc(cls.name||'—')}</td>
        <td>${group?`G${esc(group)}`:'—'}</td>
        <td>${esc(cls.module||'—')}</td>
        <td>${esc(cls.room||'—')}</td>
        <td><button type="button" class="btn btn-primary btn-sm" data-v16-open-presence="${esc(id)}"><i class="fas fa-clipboard-check"></i> Présence</button></td>
      </tr>`;
    }).join('');

    container.innerHTML=`<div class="table-responsive"><table class="table" data-v16-real-timetable="true">
      <thead><tr><th>Date</th><th>Jour</th><th>Horaire</th><th>Classe</th><th>Groupe</th><th>Module</th><th>Salle</th><th>Action</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;

    for(const button of container.querySelectorAll('[data-v16-open-presence]')){
      button.addEventListener('click',()=>openPresenceForSession(button.getAttribute('data-v16-open-presence'),options));
    }
    return true;
  }

  function install(){
    if(typeof root.document==='undefined')return false;
    root.renderMyTimetable=renderTimetableSessions;
    if(root.document.getElementById('emploi')?.classList.contains('active'))renderTimetableSessions();
    return true;
  }

  if(typeof root.document!=='undefined'){
    if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',install);
    else install();
  }

  return {openPresenceForSession,renderTimetableSessions,install};
});
