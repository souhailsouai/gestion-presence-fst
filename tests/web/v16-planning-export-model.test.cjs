const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path='web/v16-planning-export-model.js';
const source=fs.existsSync(path)?fs.readFileSync(path,'utf8'):'';
let api=null;
try{api=require('../../web/v16-planning-export-model.js');}catch(_){api=null;}

const filtered=[
  {date:'2026-09-14',weekday:'monday',start:'13:45',end:'17:30',className:'MPI1-A',isTeachingSession:true,groups:[
    {groupNo:1,manipulation:'M1',room:'C',teacherId:'t1'},
    {groupNo:2,manipulation:'M2',room:'B',teacherId:'t2'}
  ]},
  {date:'2026-09-21',weekday:'monday',start:'13:45',end:'17:30',className:'MPI1-E',isTeachingSession:true,groups:[
    {groupNo:1,manipulation:'M1',room:'C',teacherId:'t3'}
  ]}
];
const teachers=[{id:'t1',full_name:'Nadia'},{id:'t2',full_name:'Olfa'},{id:'t3',full_name:'Souhail'}];

test('V16 planning export model exists and exposes pure builder',()=>{
  assert.ok(source.length>0,'export model missing');
  assert.ok(api);
  assert.equal(typeof api.buildPlanningExportModel,'function');
});

test('model flattens exactly the current filtered planning rows',()=>{
  const model=api.buildPlanningExportModel(filtered,{teachers,generatedAt:'2026-09-03T20:00:00Z',filters:{}});
  assert.equal(model.rows.length,3);
  assert.deepEqual(model.columns,['Semaine','Date','Jour','Horaire','Classe','Groupe','Manipulation','Salle','Enseignant']);
  assert.equal(model.rows[0].Classe,'MPI1-A');
  assert.equal(model.rows[0].Groupe,'G1');
  assert.equal(model.rows[0].Enseignant,'Nadia');
  assert.equal(model.summary.posts,3);
});

test('export title and subtitle reflect active class group teacher week room manipulation filters',()=>{
  const filters={className:'MPI1-A',groupNo:'2',teacherId:'t2',week:'2026-W38',room:'B',manipulation:'M2'};
  const model=api.buildPlanningExportModel(filtered.slice(0,1).map(r=>({...r,groups:[r.groups[1]]})),{teachers,filters,generatedAt:'2026-09-03T20:00:00Z'});
  for(const marker of ['MPI1-A','G2','Olfa','2026-W38','Salle B','M2'])assert.match(model.subtitle,new RegExp(marker),marker);
  assert.match(model.title,/Planning des séances/i);
  assert.match(model.generatedAt,/2026/);
});

test('model can represent complete planning and non-teaching rows without TEST labels',()=>{
  const rows=[...filtered,{date:'2026-11-02',weekday:'monday',start:'13:45',end:'17:30',isTeachingSession:false,reason:'REPOS',groups:[]}];
  const model=api.buildPlanningExportModel(rows,{teachers,filters:{},context:'real'});
  assert.equal(model.rows.length,4);
  assert.ok(model.rows.some(r=>r.État==='REPOS'));
  assert.doesNotMatch(JSON.stringify(model),/MODE TEST|TEST uniquement|v16_test_/i);
});
