'use strict';
// Appel S2 depuis le planning : quelles cases apparaissent dans le menu des séances.
const test=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');
const {options}=require(path.join(__dirname,'..','..','web','v44-s2-appel.js'));
const D='00000000-0000-4000-8000-000000000001',X='11111111-1111-4111-8111-111111111111';
const ses=(d)=>({session_date:d,start_time:'08:00:00',end_time:'11:00:00',class_name:'MPI1-A'});
const rows=[
  {id:'a',space_id:D,group_no:1,manipulation_code:'M1',teacher_id:'me',room:'A',attendance_session_id:null,session:ses('2027-01-12')},
  {id:'b',space_id:D,group_no:2,manipulation_code:'M2',teacher_id:'me',room:'B',attendance_session_id:null,session:ses('2027-02-02')},
  {id:'c',space_id:D,group_no:3,manipulation_code:'M3',teacher_id:'other',room:'C',attendance_session_id:null,session:ses('2027-01-12')},
  {id:'d',space_id:X,group_no:1,manipulation_code:'M1',teacher_id:'other',room:'',attendance_session_id:'sess-9',session:ses('2027-01-12')},
  {id:'e',space_id:D,group_no:1,manipulation_code:'M1',teacher_id:'me',room:'A',attendance_session_id:null,session:ses('2026-12-01')}];
const base={userId:'me',isAdmin:false,isSuper:false,today:'2027-01-20',adminSpaces:new Set(),spaceNames:new Map([[X,'LPHE1']])};
test('Enseignant : seulement ses cases, jusqu\'à aujourd\'hui, jamais avant le S2',()=>{
  const o=options(rows,base);
  assert.deepEqual(o.map(x=>x.value),['s2:a']);
  assert.match(o[0].label,/^S2 · 12\/01\/2027 — MPI1-A-G1 — M1 — Salle A — 08:00–11:00$/);
});
test('Administrateur d\'espace : toutes les cases de son espace, même futures ; case ouverte = séance',()=>{
  const o=options(rows,{...base,adminSpaces:new Set([X])});
  assert.deepEqual(o.map(x=>x.value).sort(),['s2:a','sess-9']);
  assert.match(o.find(x=>x.value==='sess-9').label,/\[LPHE1\]$/);
  const all=options(rows,{...base,isAdmin:true});
  assert.deepEqual(all.map(x=>x.value).sort(),['s2:a','s2:b','s2:c']);
});
