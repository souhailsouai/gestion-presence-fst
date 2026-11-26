'use strict';
// Carte « Maintenant », « À rattraper » et recherche (V48).
const test=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');
const {pickNow,makeupRows,safeQuery}=require(path.join(__dirname,'..','..','web','v48-maintenant.js'));
test('Maintenant : la séance en cours, sinon la prochaine ; les séances finies sont ignorées',()=>{
  const items=[{title:'A',start:'08:00',end:'11:00',done:true},{title:'B',start:'14:00',end:'17:00',done:false},{title:'C',start:'08:00',end:'11:00',done:false}];
  assert.equal(pickNow(items,'09:15').title,'C');assert.equal(pickNow(items,'09:15').when,'en cours');
  assert.equal(pickNow(items,'12:30').title,'B');assert.equal(pickNow(items,'12:30').when,'dans 90 min');
  assert.equal(pickNow(items,'10:00').when,'en cours');
  assert.equal(pickNow(items,'17:30'),null);
  assert.equal(pickNow([{title:'D',start:'14:00',end:'17:00'}],'08:00').when,'à 14h00');
});
test('À rattraper : 2 absences ou plus, créneau proposé dans un autre groupe',()=>{
  const abs=[{student_id:'s1',name:'X Y',date:'2027-01-12',class_name:'MPI1-A-G3'},{student_id:'s1',name:'X Y',date:'2027-01-26',class_name:'MPI1-A-G3'},{student_id:'s2',name:'Z W',date:'2027-01-12',class_name:'MPI1-A-G1'}];
  const plan=[{class_name:'MPI1-A',session_date:'2027-01-12',start_time:'08:00:00',slots:[{group_no:3,manipulation_code:'M2'},{group_no:1,manipulation_code:'M1'}]},
    {class_name:'MPI1-A',session_date:'2027-01-26',start_time:'08:00:00',slots:[{group_no:3,manipulation_code:'M3'}]},
    {class_name:'MPI1-A',session_date:'2027-02-09',start_time:'08:00:00',slots:[{group_no:4,manipulation_code:'M2',room:'B12'},{group_no:3,manipulation_code:'M2'}]}];
  const r=makeupRows(abs,plan,'2027-02-01');
  assert.equal(r.length,1);assert.equal(r[0].student_id,'s1');
  assert.deepEqual(r[0].missed.map(m=>m.manip),['M2','M3']);
  assert.match(r[0].suggestion,/09\/02 · 08:00 · G4 — M2 · Salle B12$/);
});
test('Recherche : le texte saisi ne peut pas modifier le filtre de la base',()=>{
  assert.equal(safeQuery('ben,salah).or(x'),'ben salah or x');
  assert.equal(safeQuery("  Ben  Ali  "),'Ben Ali');
  assert.equal(safeQuery("Ghaḍa"),'Ghaḍa');
});
