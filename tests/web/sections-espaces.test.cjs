'use strict';
// V54 : une section par espace (comme LPC3) ; rien de LPHE1 sous MPI1 · PC1.
const test=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');const fs=require('node:fs');
const {keep,DEF}=require(path.join(__dirname,'..','..','web','v54-espaces.js'));
const {options}=require(path.join(__dirname,'..','..','web','v44-s2-appel.js'));
const L='lphe';
const classSpace=new Map([['mpi',DEF],['old',null],['lp',L]]);
const sessionClass=new Map([['s-mpi','mpi'],['s-lp','lp']]);
test('Section MPI1 · PC1 : les classes, étudiants, séances et présences de LPHE1 sont cachés',()=>{
  assert.equal(keep('classes',{id:'mpi'},DEF,classSpace,sessionClass),true);
  assert.equal(keep('classes',{id:'old'},DEF,classSpace,sessionClass),true,'classe sans espace = MPI1 · PC1');
  assert.equal(keep('classes',{id:'lp'},DEF,classSpace,sessionClass),false);
  assert.equal(keep('students',{class_id:'lp'},DEF,classSpace,sessionClass),false);
  assert.equal(keep('sessions',{class_id:'lp'},DEF,classSpace,sessionClass),false);
  assert.equal(keep('attendance',{session_id:'s-lp'},DEF,classSpace,sessionClass),false);
  assert.equal(keep('attendance',{session_id:'s-mpi'},DEF,classSpace,sessionClass),true);
});
test('Section LPHE1 : seulement LPHE1',()=>{
  assert.equal(keep('classes',{id:'lp'},L,classSpace,sessionClass),true);
  assert.equal(keep('classes',{id:'mpi'},L,classSpace,sessionClass),false);
  assert.equal(keep('attendance',{session_id:'s-mpi'},L,classSpace,sessionClass),false);
});
test('En cas de doute, rien n’est caché (classe ou séance inconnue)',()=>{
  assert.equal(keep('sessions',{class_id:'nouvelle'},L,classSpace,sessionClass),true);
  assert.equal(keep('attendance',{session_id:'inconnue'},DEF,classSpace,sessionClass),true);
  assert.equal(keep('profiles',{id:'x'},L,classSpace,sessionClass),true,'les autres tables ne sont pas filtrées');
});
test('Appel S2 : le menu ne propose que les séances de l’espace de la section',()=>{
  const s={session_date:'2027-02-01',start_time:'14:00',end_time:'17:00',class_name:'X'};
  const rows=[{id:'a',space_id:DEF,group_no:1,teacher_id:'u',session:s},{id:'b',space_id:L,group_no:1,teacher_id:'u',session:s}];
  const base={userId:'u',today:'2027-02-01',isSuper:true};
  assert.deepEqual(options(rows,{...base,section:DEF}).map(o=>o.value),['s2:a']);
  assert.deepEqual(options(rows,{...base,section:L}).map(o=>o.value),['s2:b']);
});
test('Menu « Espaces » et Semestres verrouillé sur la section',()=>{
  const js=fs.readFileSync(path.join(__dirname,'..','..','web','v54-espaces.js'),'utf8');
  assert.ok(js.includes('Espaces')&&js.includes('Revenir à MPI1 · PC1'));
  const v33=fs.readFileSync(path.join(__dirname,'..','..','web','v33-semestres.js'),'utf8');
  assert.ok(v33.includes('state.lockSpace'));
  assert.ok(fs.readFileSync(path.join(__dirname,'..','..','web','index.html'),'utf8').includes('v54-espaces.js'));
});
