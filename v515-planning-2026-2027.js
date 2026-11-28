(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./v515-planning-core.js'):root.V515Planning);
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.V515PlanningData=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(planning){
  'use strict';
  if(!planning)throw new Error('V515Planning is required');

  const manipulationRooms={M1:'C',M2:'B',M3:'A',M4:'D',M5:'B',M6:'A'};
  const teacherPools={
    monday:['Khaoula Rais','Souhail Souai','Nadia Bouaziz','Olfa Turki'],
    thursday:['Khaoula Rais','Souhail Souai','Tarek Sbeouelji','Mouna Triki'],
    friday:['Nadia Bouaziz','Olfa Turki','Tarek Sbeouelji','Mouna Triki']
  };

  const definitions=[
    {
      weekday:'monday',slot:'13:45-17:30',pair:['MPI1-A','MPI1-E'],
      rows:[
        ['2026-09-14',true],['2026-09-21',true],['2026-09-28',true],['2026-10-05',true],
        ['2026-10-12',true],['2026-10-19',true],['2026-10-26',true],['2026-11-02',false,'REPOS'],
        ['2026-11-09',true],['2026-11-16',true],['2026-11-23',true],['2026-11-30',true]
      ]
    },
    {
      weekday:'thursday',slot:'13:30-17:30',pair:['MPI1-C','MPI1-D'],
      rows:[
        ['2026-09-17',true],['2026-09-24',true],['2026-10-01',true],['2026-10-08',true],
        ['2026-10-15',false,"JOUR FERIE - Fete de l'Evacuation"],['2026-10-22',true],['2026-10-29',true],
        ['2026-11-05',false,'REPOS'],['2026-11-12',true],['2026-11-19',true],['2026-11-26',true],['2026-12-03',true]
      ]
    },
    {
      weekday:'friday',slot:'13:30-17:30',pair:['MPI1-B','PC1-A'],
      rows:[
        ['2026-09-18',true],['2026-09-25',true],['2026-10-02',true],['2026-10-09',true],
        ['2026-10-16',true],['2026-10-23',true],['2026-10-30',true],['2026-11-06',false,'REPOS'],
        ['2026-11-13',true],['2026-11-20',true],['2026-11-27',true],['2026-12-04',true]
      ]
    }
  ];

  const calendarRows=[];
  for(const d of definitions){
    const built=planning.buildEffectiveSessions(
      d.rows.map(([date,isTeachingSession,reason])=>({date,isTeachingSession,reason:reason||null,weekday:d.weekday,slot:d.slot})),
      d.pair,4,6
    );
    for(const row of built){
      const posts=row.isTeachingSession?(row.groups||[]).map(g=>({
        groupNo:g.groupNo,
        manipulation:g.manipulation,
        room:manipulationRooms[g.manipulation],
        teacherId:null
      })):[];
      calendarRows.push(Object.assign({},row,{pair:d.pair.slice(),posts,allowedTeachers:row.isTeachingSession?teacherPools[d.weekday].slice():[]}));
    }
  }

  const expectedClasses=['MPI1-A','MPI1-E','MPI1-C','MPI1-D','MPI1-B','PC1-A'];
  const completeness={};
  for(const className of expectedClasses)completeness[className]=planning.completeness(calendarRows,className,4,6);

  return {academicYear:'2026/2027',semester:1,groupCount:4,manipulationCount:6,manipulationRooms,teacherPools,definitions,calendarRows,completeness};
});
