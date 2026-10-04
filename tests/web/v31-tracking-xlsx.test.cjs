const test=require('node:test');
const assert=require('node:assert/strict');
global.FSTV31Domain=require('../../web/v31-domain.js');
global.FSTV31Config=require('../../web/v31-config.js');
const X=require('../../web/v31-tracking-xlsx.js');

const students=[
  {id:'s1',last_name:'Ben Ali',first_name:'Amine',groupName:'MPI1-A-G1'},
  {id:'s2',last_name:'Trabelsi',first_name:'Sara',groupName:'MPI1-A-G1'}
];
const rows=[
  {studentId:'s1',status:'present',environment:'MPI1_PC1',manipulationCode:'M1',grade:15},
  {studentId:'s1',status:'absent',environment:'MPI1_PC1',manipulationCode:'M2',grade:0,gradeOrigin:'absence_auto'},
  {studentId:'s2',status:'retard',environment:'MPI1_PC1',manipulationCode:'M1',grade:12},
  {studentId:'s2',status:'justifie',environment:'MPI1_PC1',manipulationCode:'M2',grade:null}
];

test('class export follows attendance and grade business rules',()=>{
  const m=X.buildSheetModel({environment:'MPI1_PC1',className:'MPI1-A',students,rows});
  assert.deepEqual(m.manipulations.map(x=>x.code),['M1','M2']);
  assert.equal(m.rows[0]['M2 Statut'],'Absent non justifié');
  assert.equal(m.rows[0]['M2 Note'],0);
  assert.equal(m.rows[1]['M2 Statut'],'Absent justifié');
  assert.equal(m.rows[1]['M2 Note'],null);
  assert.equal(m.rows[0]['Présences'],1);
  assert.equal(m.rows[0]['Retards'],0);
  assert.equal(m.rows[0]['Abs. non justifiées'],1);
  assert.equal(m.rows[0]['Total absences'],1);
  assert.equal(m.rows[0]['Présence %'],0.5);
  assert.equal(m.rows[0]['Absence %'],0.5);
});

test('workbook spec has one sheet per supplied class',()=>{
  const spec=X.buildWorkbookSpec([
    {environment:'MPI1_PC1',className:'MPI1-A',students,rows},
    {environment:'MPI1_PC1',className:'PC1-A',students:[],rows:[]}
  ]);
  assert.equal(spec.sheets.length,2);
  assert.deepEqual(spec.sheets.map(s=>s.className),['MPI1-A','PC1-A']);
  assert.equal(spec.appVersion,'v3.1');
});

test('filenames are stable, pedagogical and year-qualified',()=>{
  assert.equal(X.globalFilename('MPI1_PC1','2026_2027'),'Suivi_TP_MPI1_PC1_2026_2027.xlsx');
  assert.equal(X.globalFilename('LPC3','2026_2027'),'Suivi_TP_LPC3_2026_2027.xlsx');
  assert.equal(X.classFilename('MPI1-A','2026_2027'),'Suivi_TP_MPI1-A_2026_2027.xlsx');
});

test('LPC3 export is explicitly separate from MPI1-PC1 export',()=>{
  const lpc=X.buildWorkbookSpec({environment:'LPC3',className:'LPC3',students:[],rows:[]},{environment:'LPC3'});
  assert.equal(lpc.environment,'LPC3');
  assert.equal(X.globalFilename(lpc.environment,'2026_2027'),'Suivi_TP_LPC3_2026_2027.xlsx');
});
