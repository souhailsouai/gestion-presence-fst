'use strict';
// Fin du S1 : à partir du 12/12/2026, les lectures des séances et du planning ne renvoient plus le S1.
const test=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');
const mod=require(path.join(__dirname,'..','..','web','v46-s1-archives.js'));
function fakeClient(log){return{from(t){const f={gte(c,v){log.push([t,c,v]);return f;},eq(){return f;}};return{select(){log.push([t,'select']);return f;},insert(){log.push([t,'insert']);return f;}};}};}
test('Avant le 12/12/2026 : rien ne change',()=>{
  mod._set({V46_TODAY:'2026-12-11'});const log=[];const c=mod.wrapClient(fakeClient(log));
  c.from('sessions').select('*');assert.deepEqual(log,[['sessions','select']]);
});
test('Après : séances et planning S1 filtrés, le reste intact, les écritures aussi',()=>{
  mod._set({V46_TODAY:'2026-12-12'});const log=[];const c=mod.wrapClient(fakeClient(log));
  c.from('sessions').select('*');c.from('session_plans').select('id');c.from('attendance').select('*');c.from('sessions').insert({});
  assert.deepEqual(log,[['sessions','select'],['sessions','session_date','2026-12-12'],['session_plans','select'],['session_plans','plan_date','2026-12-12'],['attendance','select'],['sessions','insert']]);
});
test('Archives S1 : un administrateur voit de nouveau le S1',()=>{
  mod._set({V46_TODAY:'2027-01-20',currentTeacher:{isAdmin:true},sessionStorage:{getItem:()=>'1'}});const log=[];const c=mod.wrapClient(fakeClient(log));
  c.from('sessions').select('*');assert.deepEqual(log,[['sessions','select']]);
  mod._set({currentTeacher:{isAdmin:false}});c.from('sessions').select('*');assert.deepEqual(log.slice(1),[['sessions','select'],['sessions','session_date','2026-12-12']],'un enseignant ne peut pas activer les archives');
});
