const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const modulePath='web/v16-student-groups.js';
const source=fs.existsSync(modulePath)?fs.readFileSync(modulePath,'utf8'):'';
let api=null;
try{api=require('../../web/v16-student-groups.js');}catch(_){api=null;}

const fixture={
  classes:[
    {id:'a1',name:'MPI1-A',track:'MPI',classNumber:1,groupNumber:1},
    {id:'a2',name:'MPI1-A',track:'MPI',classNumber:1,groupNumber:2},
    {id:'a3',name:'MPI1-A',track:'MPI',classNumber:1,groupNumber:3},
    {id:'b1',name:'MPI1-B',track:'MPI',classNumber:1,groupNumber:1}
  ],
  students:[
    {id:'s1',lastname:'Ben Ali',firstname:'Amine',email:'a@example.tn',classId:'a1'},
    {id:'s2',lastname:'Trabelsi',firstname:'Meriem',email:'m@example.tn',classId:'a2'},
    {id:'s3',lastname:'Gharbi',firstname:'Sami',email:'s@example.tn',classId:'b1'}
  ],
  memberships:[
    {student_id:'s1',class_id:'a1',group_no:1,effective_from:'2026-09-14',effective_to:'2026-10-12'},
    {student_id:'s1',class_id:'a3',group_no:3,effective_from:'2026-10-12',effective_to:null},
    {student_id:'s2',class_id:'a2',group_no:2,effective_from:'2026-09-14',effective_to:null}
  ]
};

test('V16 student group module exists with required API',()=>{
  assert.ok(source.length>0,'v16-student-groups.js missing');
  assert.ok(api,'module cannot be loaded');
  for(const fn of ['renderClassGroups','changeGroup','showHistory','historyText'])assert.equal(typeof api[fn],'function',fn);
});

test('student rendering separates concrete classes and exposes G1-G4 + effective date for Admin',()=>{
  const html=api.renderClassGroups(fixture,{isAdmin:true,activeMode:'admin'});
  assert.match(html,/data-v16-class-family="MPI1-A"/);
  assert.match(html,/data-v16-class-family="MPI1-B"/);
  assert.equal((html.match(/data-v16-class-family="MPI1-A"/g)||[]).length,1);
  for(const group of ['G1','G2','G3','G4'])assert.match(html,new RegExp(`>${group}<`),group);
  assert.match(html,/type="date"/);
  assert.match(html,/Historique des affectations/);
  assert.match(html,/Rendre inactif/);
});

test('teacher rendering does not expose group mutation controls',()=>{
  const html=api.renderClassGroups(fixture,{isAdmin:false,activeMode:'teacher'});
  assert.match(html,/MPI1-A/);
  assert.doesNotMatch(html,/data-v16-change-group/);
  assert.doesNotMatch(html,/Rendre inactif/);
  assert.doesNotMatch(html,/type="date"/);
});

test('history is chronological and renders exclusive effective end as previous calendar day',()=>{
  const text=api.historyText(fixture.memberships.filter(x=>x.student_id==='s1'));
  assert.deepEqual(text,[
    'G1 du 14/09/2026 au 11/10/2026',
    'G3 à partir du 12/10/2026'
  ]);
});

test('group change and membership ending use V16 RPCs then authoritative refresh',()=>{
  assert.match(source,/v16_set_student_group/);
  assert.match(source,/v16_end_student_membership/);
  assert.match(source,/refreshAuthoritativeState/);
  assert.match(source,/data-v16-change-group/);
  assert.match(source,/data-v16-end-membership/);
});


test('LPC3 hyphenated groups render as one dedicated Ondes et Vibrations family',()=>{
  const lpc={
    classes:[
      {id:'l1',name:'LPC3-G1',track:'LPC',classNumber:3,groupNumber:1,module:'TP Ondes et Vibrations'},
      {id:'l2',name:'LPC3-G2',track:'LPC',classNumber:3,groupNumber:2,module:'TP Ondes et Vibrations'},
      {id:'l3',name:'LPC3-G3',track:'LPC',classNumber:3,groupNumber:3,module:'TP Ondes et Vibrations'},
      {id:'l4',name:'LPC3-G4',track:'LPC',classNumber:3,groupNumber:4,module:'TP Ondes et Vibrations'}
    ],
    students:[
      {id:'ls1',lastname:'Alpha',firstname:'Un',classId:'l1'},
      {id:'ls2',lastname:'Beta',firstname:'Deux',classId:'l2'},
      {id:'ls3',lastname:'Gamma',firstname:'Trois',classId:'l3'},
      {id:'ls4',lastname:'Delta',firstname:'Quatre',classId:'l4'}
    ],
    memberships:[]
  };
  const html=api.renderClassGroups(lpc,{isAdmin:false,activeMode:'teacher'});
  assert.equal((html.match(/data-v16-class-family="LPC3"/g)||[]).length,1);
  assert.doesNotMatch(html,/data-v16-class-family="LPC3-G[1-4]"/);
  assert.match(html,/LPC3 — TP Ondes et Vibrations/);
  for(const group of ['G1','G2','G3','G4'])assert.match(html,new RegExp(`>${group}<`),group);
});
