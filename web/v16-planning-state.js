(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.V16PlanningState=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function assignmentKey(date,className,groupNo){return `${String(date||'')}|${String(className||'')}|${Number(groupNo)}`;}
  function createPlanningState(rows,assignments){
    const map=new Map();
    for(const a of assignments||[])map.set(assignmentKey(a.date||a.sessionDate,a.className,a.groupNo),a);
    const normalized=(rows||[]).map(row=>({...row,groups:(row.groups||[]).map(group=>{
      const persisted=map.get(assignmentKey(row.date,row.className,group.groupNo));
      return {...group,
        sessionId:persisted?.sessionId||group.sessionId||null,
        teacherId:persisted?.teacherId||null,
        manipulation:persisted?.manipulation||group.manipulation,
        room:persisted?.room??group.room??null
      };
    })}));
    return {rows:normalized};
  }

  function parseDateOnly(value){const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return null;return new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3])));}
  function isoWeek(value){const date=parseDateOnly(value);if(!date)return '';const day=date.getUTCDay()||7;date.setUTCDate(date.getUTCDate()+4-day);const year=date.getUTCFullYear();const yearStart=new Date(Date.UTC(year,0,1));const week=Math.ceil((((date-yearStart)/86400000)+1)/7);return `${year}-W${String(week).padStart(2,'0')}`;}
  function mondayFor(value){const d=parseDateOnly(value);if(!d)return '';const iso=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()-(iso-1));return d.toISOString().slice(0,10);}

  function filterPlanning(state,filters){
    const f=filters||{},output=[];
    for(const source of state?.rows||[]){
      if(f.className&&source.className!==f.className)continue;if(f.weekday&&source.weekday!==f.weekday)continue;if(f.week&&isoWeek(source.date)!==f.week)continue;if(f.fromDate&&source.date<f.fromDate)continue;if(f.toDate&&source.date>f.toDate)continue;
      let groups=(source.groups||[]).slice();
      if(f.groupNo)groups=groups.filter(g=>Number(g.groupNo)===Number(f.groupNo));if(f.manipulation)groups=groups.filter(g=>g.manipulation===f.manipulation);if(f.room)groups=groups.filter(g=>g.room===f.room);if(f.teacherId)groups=groups.filter(g=>g.teacherId===f.teacherId);
      const hasPostFilter=Boolean(f.groupNo||f.manipulation||f.room||f.teacherId);if(hasPostFilter&&!groups.length)continue;output.push({...source,groups});
    }
    return output.sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  }
  function planningSummary(rows){const visible=rows||[];return {sessionCount:visible.filter(r=>r.isTeachingSession!==false).length,assignmentCount:visible.reduce((sum,r)=>sum+(r.groups||[]).filter(g=>Boolean(g.teacherId)).length,0)};}

  function validateManipulationHistory(rows){
    const seen=new Map(),blockers=[];
    for(const row of (rows||[]).filter(r=>r.isTeachingSession!==false&&r.className))for(const g of row.groups||[]){
      if(!g.manipulation)continue;
      const key=`${row.className}|${Number(g.groupNo)}|${g.manipulation}`;
      if(seen.has(key))blockers.push({code:'REPEATED_GROUP_MANIPULATION',date:row.date,className:row.className,groupNo:Number(g.groupNo),manipulation:g.manipulation,message:`${row.className} G${g.groupNo} a déjà ${g.manipulation}.`});
      else seen.set(key,row.date);
    }
    return blockers;
  }

  function validateWeek(rows,teachers,options={}){
    const teaching=(rows||[]).filter(r=>r.isTeachingSession!==false&&r.className),blockers=[];
    const teacherIds=(teachers||[]).map(t=>typeof t==='string'?t:t.id).filter(Boolean);
    for(const row of teaching){
      const groups=row.groups||[],rooms=groups.map(g=>g.room).filter(Boolean),ids=groups.map(g=>g.teacherId).filter(Boolean);
      if(groups.length!==4||ids.length!==4||new Set(ids).size!==4)blockers.push({code:'DAY_TEACHER_COUNT',date:row.date,message:'Chaque jour de TP doit avoir exactement 4 enseignants distincts.'});
      if(groups.some(g=>!g.room))blockers.push({code:'ROOM_REQUIRED',date:row.date,message:'Toutes les salles doivent être choisies.'});
      if(rooms.length!==new Set(rooms).size)blockers.push({code:'ROOM_TIME_CONFLICT',date:row.date,message:'Deux groupes simultanés ne peuvent pas utiliser la même salle.'});
    }
    blockers.push(...validateManipulationHistory(teaching));
    if(options.skipTeacherDistribution)return {ok:blockers.length===0,blockers,distribution:{}};
    const daysByTeacher=new Map(teacherIds.map(id=>[String(id),new Set()]));
    for(const row of teaching)for(const id of new Set((row.groups||[]).map(g=>g.teacherId).filter(Boolean))){if(!daysByTeacher.has(String(id)))daysByTeacher.set(String(id),new Set());daysByTeacher.get(String(id)).add(row.date);}
    const distribution={};for(const [id,dates] of daysByTeacher){distribution[id]=dates.size;if(dates.size>2)blockers.push({code:'MAX_TWO_DAYS_PER_TEACHER',teacherId:id,days:dates.size,message:'Aucun enseignant ne peut dépasser 2 jours par semaine.'});}
    const dayCount=new Set(teaching.map(r=>r.date)).size,counts=teacherIds.map(id=>distribution[String(id)]||0).sort((a,b)=>b-a);
    if(dayCount===3&&counts.some(n=>n!==2))blockers.push({code:'TEACHER_WEEKDAY_COUNT',message:'En semaine normale, chaque enseignant doit intervenir exactement 2 jours.'});
    else if(dayCount===2&&counts.join(',')!=='2,2,1,1,1,1')blockers.push({code:'HOLIDAY_WEEK_DISTRIBUTION',message:'Semaine réduite : répartition attendue 2,2,1,1,1,1.'});
    else if(![0,2,3].includes(dayCount))blockers.push({code:'TEACHING_DAY_COUNT_UNSUPPORTED',days:dayCount,message:'Nombre de jours de TP non pris en charge.'});
    return {ok:blockers.length===0,blockers,distribution};
  }

  return {createPlanningState,filterPlanning,planningSummary,isoWeek,mondayFor,validateWeek,validateManipulationHistory};
});
