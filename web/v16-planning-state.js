(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.V16PlanningState=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  function assignmentKey(date,className,groupNo){
    return `${String(date||'')}|${String(className||'')}|${Number(groupNo)}`;
  }

  function createPlanningState(rows,assignments){
    const map=new Map();
    for(const a of assignments||[]){
      map.set(assignmentKey(a.date||a.sessionDate,a.className,a.groupNo),a.teacherId||null);
    }
    const normalized=(rows||[]).map(row=>({
      ...row,
      groups:(row.groups||[]).map(group=>({
        ...group,
        teacherId:map.get(assignmentKey(row.date,row.className,group.groupNo))||null
      }))
    }));
    return {rows:normalized};
  }

  function parseDateOnly(value){
    const m=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m)return null;
    return new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3])));
  }

  function isoWeek(value){
    const date=parseDateOnly(value);
    if(!date)return '';
    const day=date.getUTCDay()||7;
    date.setUTCDate(date.getUTCDate()+4-day);
    const year=date.getUTCFullYear();
    const yearStart=new Date(Date.UTC(year,0,1));
    const week=Math.ceil((((date-yearStart)/86400000)+1)/7);
    return `${year}-W${String(week).padStart(2,'0')}`;
  }

  function filterPlanning(state,filters){
    const f=filters||{};
    const output=[];
    for(const source of state?.rows||[]){
      if(f.className&&source.className!==f.className)continue;
      if(f.weekday&&source.weekday!==f.weekday)continue;
      if(f.week&&isoWeek(source.date)!==f.week)continue;
      if(f.fromDate&&source.date<f.fromDate)continue;
      if(f.toDate&&source.date>f.toDate)continue;

      let groups=(source.groups||[]).slice();
      if(f.groupNo)groups=groups.filter(g=>Number(g.groupNo)===Number(f.groupNo));
      if(f.manipulation)groups=groups.filter(g=>g.manipulation===f.manipulation);
      if(f.room)groups=groups.filter(g=>g.room===f.room);
      if(f.teacherId)groups=groups.filter(g=>g.teacherId===f.teacherId);

      const hasPostFilter=Boolean(f.groupNo||f.manipulation||f.room||f.teacherId);
      if(hasPostFilter&&!groups.length)continue;
      output.push({...source,groups});
    }
    return output.sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  }

  function planningSummary(rows){
    const visible=rows||[];
    return {
      sessionCount:visible.filter(r=>r.isTeachingSession!==false).length,
      assignmentCount:visible.reduce((sum,r)=>sum+(r.groups||[]).filter(g=>Boolean(g.teacherId)).length,0)
    };
  }

  return {createPlanningState,filterPlanning,planningSummary,isoWeek};
});
