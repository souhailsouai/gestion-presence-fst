(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./v515-planning-2026-2027.js'):root.V515PlanningData);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.V16PlanningData=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(seed){
  'use strict';
  if(!seed)throw new Error('V515PlanningData is required');
  const manipulationRooms=Object.freeze(Object.assign({},seed.manipulationRooms));
  const occurrencePatterns=Object.freeze([
    Object.freeze(['M1','M2','M3','M4']),
    Object.freeze(['M2','M3','M4','M1']),
    Object.freeze(['M3','M4','M1','M2']),
    Object.freeze(['M4','M1','M2','M3']),
    Object.freeze(['M5','M6','M5','M6']),
    Object.freeze(['M6','M5','M6','M5'])
  ]);
  const approvedRows=Object.freeze([
    ['2026-09-14','monday','13:45','17:30','MPI1-A',1],['2026-09-21','monday','13:45','17:30','MPI1-E',1],['2026-09-28','monday','13:45','17:30','MPI1-A',2],['2026-10-05','monday','13:45','17:30','MPI1-E',2],['2026-10-12','monday','13:45','17:30','MPI1-A',3],['2026-10-19','monday','13:45','17:30','MPI1-E',3],['2026-10-26','monday','13:45','17:30','MPI1-A',4],['2026-11-02','monday','13:45','17:30',null,null,'DS / aucun TP'],['2026-11-09','monday','13:45','17:30','MPI1-E',4],['2026-11-16','monday','13:45','17:30','MPI1-A',5],['2026-11-23','monday','13:45','17:30','MPI1-E',5],['2026-11-30','monday','13:45','17:30','MPI1-A',6],
    ['2026-09-17','thursday','13:30','17:30','MPI1-C',1],['2026-09-24','thursday','13:30','17:30','MPI1-D',1],['2026-10-01','thursday','13:30','17:30','MPI1-C',2],['2026-10-08','thursday','13:30','17:30','MPI1-D',2],['2026-10-15','thursday','13:30','17:30',null,null,"JOUR FÉRIÉ - Fête de l'Évacuation - aucun TP"],['2026-10-22','thursday','13:30','17:30','MPI1-C',3],['2026-10-29','thursday','13:30','17:30','MPI1-D',3],['2026-11-05','thursday','13:30','17:30',null,null,'DS / aucun TP'],['2026-11-12','thursday','13:30','17:30','MPI1-C',4],['2026-11-19','thursday','13:30','17:30','MPI1-D',4],['2026-11-26','thursday','13:30','17:30','MPI1-C',5],['2026-12-03','thursday','13:30','17:30','MPI1-D',5],
    ['2026-09-18','friday','13:30','17:30','MPI1-B',1],['2026-09-25','friday','13:30','17:30','PC1-A',1],['2026-10-02','friday','13:30','17:30','MPI1-B',2],['2026-10-09','friday','13:30','17:30','PC1-A',2],['2026-10-16','friday','13:30','17:30','MPI1-B',3],['2026-10-23','friday','13:30','17:30','PC1-A',3],['2026-10-30','friday','13:30','17:30','MPI1-B',4],['2026-11-06','friday','13:30','17:30',null,null,'DS / aucun TP'],['2026-11-13','friday','13:30','17:30','PC1-A',4],['2026-11-20','friday','13:30','17:30','MPI1-B',5],['2026-11-27','friday','13:30','17:30','PC1-A',5],['2026-12-04','friday','13:30','17:30','MPI1-B',6]
  ]);
  function normalize(entry){const [date,weekday,start,end,className,occurrence,reason]=entry;const teaching=Boolean(className&&occurrence);return {date,weekday,start,end,className:teaching?className:null,isTeachingSession:teaching,reason:teaching?null:(reason||'Aucun TP'),classOccurrence:teaching?occurrence:null,groups:teaching?occurrencePatterns[occurrence-1].map((manipulation,index)=>({groupNo:index+1,manipulation,room:null})):[]};}
  function rows(){return approvedRows.map(normalize);}
  return {academicYear:'2026/2027',semester:1,manipulationRooms,occurrencePatterns,rows};
});
