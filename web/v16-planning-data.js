(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./v515-planning-2026-2027.js'):root.V515PlanningData);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.V16PlanningData=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(seed){
  'use strict';
  if(!seed)throw new Error('V515PlanningData is required');

  const manipulationRooms=Object.freeze(Object.assign({},seed.manipulationRooms));

  function splitSlot(slot){
    const parts=String(slot||'').split('-');
    return {start:parts[0]||'',end:parts[1]||''};
  }

  function normalizeRow(row){
    const slot=splitSlot(row.slot);
    return {
      date:row.date,
      weekday:row.weekday,
      start:slot.start,
      end:slot.end,
      className:row.className||null,
      isTeachingSession:Boolean(row.isTeachingSession),
      reason:row.reason||null,
      groups:(row.posts||[]).map(post=>({
        groupNo:Number(post.groupNo),
        manipulation:post.manipulation,
        room:post.room
      }))
    };
  }

  function rows(){
    return (seed.calendarRows||[]).map(normalizeRow);
  }

  return {academicYear:seed.academicYear,semester:seed.semester,manipulationRooms,rows};
});
