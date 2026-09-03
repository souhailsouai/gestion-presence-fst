(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.V16PlanningExportModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function fmtDate(value){
    const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m?`${m[3]}/${m[2]}/${m[1]}`:String(value||'');
  }
  function dayLabel(day){return ({monday:'Lundi',thursday:'Jeudi',friday:'Vendredi'})[day]||day||'—';}
  function isoWeek(value){
    const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return '';
    const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));const day=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()+4-day);
    const y=d.getUTCFullYear(),y0=new Date(Date.UTC(y,0,1));const w=Math.ceil((((d-y0)/86400000)+1)/7);
    return `${y}-W${String(w).padStart(2,'0')}`;
  }
  function generated(value){
    const d=value?new Date(value):new Date();
    if(Number.isNaN(d.getTime()))return String(value||'');
    return new Intl.DateTimeFormat('fr-FR',{dateStyle:'short',timeStyle:'short',timeZone:'Africa/Tunis'}).format(d);
  }
  function teacherMap(list){return new Map((list||[]).map(t=>[String(t.id),t.full_name||t.name||String(t.id)]));}
  function subtitle(filters={},teachers=[]){
    const parts=[];const tm=teacherMap(teachers);
    if(filters.className)parts.push(filters.className);
    if(filters.groupNo)parts.push(`G${filters.groupNo}`);
    if(filters.teacherId)parts.push(tm.get(String(filters.teacherId))||String(filters.teacherId));
    if(filters.week)parts.push(filters.week);
    if(filters.room)parts.push(`Salle ${filters.room}`);
    if(filters.manipulation)parts.push(filters.manipulation);
    if(filters.weekday)parts.push(dayLabel(filters.weekday));
    if(filters.fromDate||filters.toDate)parts.push(`${filters.fromDate?`du ${fmtDate(filters.fromDate)}`:''}${filters.toDate?` au ${fmtDate(filters.toDate)}`:''}`.trim());
    return parts.length?parts.join(' · '):'Planning complet';
  }
  function buildPlanningExportModel(filteredState,meta={}){
    const rows=Array.isArray(filteredState)?filteredState:(filteredState?.rows||[]);
    const teachers=meta.teachers||[];const tm=teacherMap(teachers);const out=[];
    for(const row of rows){
      const base={Semaine:isoWeek(row.date),Date:fmtDate(row.date),Jour:dayLabel(row.weekday),Horaire:`${row.start||''}${row.end?`–${row.end}`:''}`};
      if(row.isTeachingSession===false){
        out.push({...base,Classe:'—',Groupe:'—',Manipulation:'—',Salle:'—',Enseignant:'—',État:row.reason||'Aucun TP'});
        continue;
      }
      for(const group of row.groups||[]){
        out.push({...base,Classe:row.className||'—',Groupe:`G${group.groupNo}`,Manipulation:group.manipulation||'—',Salle:group.room?`Salle ${group.room}`:'—',Enseignant:group.teacherId?(tm.get(String(group.teacherId))||String(group.teacherId)):'Non affecté',État:group.teacherId?'Affectée':'À affecter'});
      }
    }
    const teaching=rows.filter(r=>r.isTeachingSession!==false);
    return {
      title:'Planning des séances — FST',
      subtitle:subtitle(meta.filters||{},teachers),
      generatedAt:generated(meta.generatedAt),
      academicYear:meta.academicYear||'2026/2027',
      semester:meta.semester||'Semestre 1',
      context:meta.context==='test'?'test':'real',
      columns:['Semaine','Date','Jour','Horaire','Classe','Groupe','Manipulation','Salle','Enseignant'],
      rows:out,
      summary:{sessions:teaching.length,posts:out.filter(r=>r.Groupe!=='—').length,nonTeaching:out.filter(r=>r.Groupe==='—').length}
    };
  }
  return {buildPlanningExportModel};
});
