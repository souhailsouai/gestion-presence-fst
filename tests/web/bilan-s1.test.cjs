'use strict';
// Bilan Excel du S1 : couleurs des absences, rattrapages, cases vides jamais comptées.
const test=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');
const B=require(path.join(__dirname,'..','..','web','v34-bilan-s1.js'));
const data={classes:[{id:1,name:'MPI1-A-G1'},{id:2,name:'MPI1-A-G2'},{id:3,name:'PC1-A-G1'},{id:9,name:'LPC3-G1'}],
  students:[{id:'a',last_name:'BEN ALI',first_name:'Sarra',class_id:1},{id:'b',last_name:'TRABELSI',first_name:'Amine',class_id:2},{id:'c',last_name:'GHARBI',first_name:'Yasmine',class_id:1},{id:'d',last_name:'ZOUARI',first_name:'Malek',class_id:3}],
  sessions:[{id:'s1',class_id:1,session_date:'2026-09-14'},{id:'s2',class_id:1,session_date:'2026-09-28'},{id:'s3',class_id:2,session_date:'2026-09-14'},{id:'s4',class_id:3,session_date:'2026-11-06'},{id:'s5',class_id:1,session_date:'2027-01-11'}],
  plans:[{session_id:'s1',manipulation:'M1'},{session_id:'s2',manipulation:'M2'},{session_id:'s3',manipulation:'M2'},{session_id:'s4',manipulation:'M1'}],
  attendance:[{session_id:'s1',student_id:'a',status:'present',grade:14.5},{session_id:'s2',student_id:'a',status:'absent',makeup_date:'2026-10-05',grade:12},
    {session_id:'s1',student_id:'c',status:'absent'},{session_id:'s2',student_id:'c',status:'justifie'},{session_id:'s3',student_id:'b',status:'retard',grade:11},
    {session_id:'s4',student_id:'d',status:'absent'},{session_id:'s5',student_id:'a',status:'absent'}]};
test('Bilan S1 : une feuille par classe MPI1/PC1, sans LPC3 ni S2',()=>{
  const m=B.build(data);
  assert.deepEqual(m.sheets.map(s=>s.name),['MPI1-A','PC1-A']);
  assert.deepEqual(m.manips,['M1','M2']);
  const a=m.sheets[0].rows.find(r=>r[1]==='BEN ALI');
  assert.equal(a[4],14.5);assert.equal(a[5],'Ratt. 05/10 — 12');
  assert.equal(a[9],null,'absence du S2 non comptée');
});
test('Bilan S1 : rouge = absent non rattrapé, orange = justifié, vert = rattrapé, vide = rien',()=>{
  const m=B.build(data),sh=m.sheets[0];
  const ri=sh.rows.findIndex(r=>r[1]==='GHARBI');
  assert.equal(sh.rows[ri][4],'ABS 14/09');assert.equal(sh.styles[ri][4].fill,'FFC7CE');
  assert.equal(sh.styles[ri][5].fill,'FFEB9C');assert.equal(sh.styles[ri][1].fill,'FFC7CE');
  const ai=sh.rows.findIndex(r=>r[1]==='BEN ALI');assert.equal(sh.styles[ai][5].fill,'C6EFCE');assert.equal(sh.styles[ai][1].fill,'C6EFCE');
  const ti=sh.rows.findIndex(r=>r[1]==='TRABELSI');assert.equal(sh.rows[ti][4],null);assert.equal(sh.styles[ti][1],null);
  assert.deepEqual(m.summary[0],['MPI1-A',3,1,1,1,1]);
});
test('Bilan S1 : un étudiant déplacé au S2 reste dans son groupe du S1',()=>{
  const moved={...data,classes:[...data.classes,{id:4,name:'MPI1-B-G1'}],students:data.students.map(s=>s.id==='c'?{...s,class_id:4}:s.id==='b'?{...s,class_id:1}:s)};
  const m=B.build(moved);const sh=m.sheets.find(s=>s.name==='MPI1-A');
  assert.ok(sh.rows.some(r=>r[1]==='GHARBI'),'GHARBI reste en MPI1-A');
  assert.equal(sh.rows.find(r=>r[1]==='GHARBI')[3],'G1');
  assert.equal(sh.rows.find(r=>r[1]==='TRABELSI')[3],'G2','groupe du S1, pas la liste actuelle');
  assert.ok(!m.sheets.some(s=>s.name==='MPI1-B'),'aucune feuille créée par le S2');
});
test('Bilan S2 : même modèle, période du S2 seulement',()=>{
  const s2={...data,sem:'S2',sessions:data.sessions.map((s,i)=>({...s,session_date:i===0?'2027-01-12':'2026-10-10'}))};
  const m=B.build(s2);
  assert.ok(m.sheets.length>=1,'au moins une feuille');
  assert.match(m.sheets[0].title,/^Bilan S2 — /);
  assert.ok(B.build({...data,sem:'S2'}).sheets.every(sh=>sh.rows.every(r=>!r.slice(4).some(v=>/^(A|P|R|J)$/.test(String(v))))),'aucune séance du S1 dans le bilan S2');
});
