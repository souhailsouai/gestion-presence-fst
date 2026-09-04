const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path='web/v16-test-mode.js';
const source=fs.existsSync(path)?fs.readFileSync(path,'utf8'):'';
let api=null;
try{api=require('../../web/v16-test-mode.js');}catch(_){api=null;}

test('V16 test mode module exposes context API',()=>{
  assert.ok(source.length>0,'v16-test-mode.js missing');
  assert.ok(api,'module cannot be loaded');
  for(const fn of ['getContext','setContext','resetTest','render','previewApply','applyToReal','cloneRealToTest'])assert.equal(typeof api[fn],'function',fn);
});

test('Admin markup contains a highly visible REAL TEST switch, badge and reset control',()=>{
  const html=api.render({isAdmin:true,activeRole:'admin'});
  assert.match(html,/MODE RÉEL/);
  assert.match(html,/MODE TEST/);
  assert.match(html,/data-v16-context-badge/);
  assert.match(html,/Réinitialiser TEST/);
  assert.match(html,/data-v16-test-reset/);
});

test('teacher role renders no TEST or apply controls',()=>{
  const html=api.render({isAdmin:false,activeRole:'teacher'});
  assert.equal(html,'');
  assert.doesNotMatch(html,/MODE TEST|Réinitialiser|Appliquer au RÉEL/);
});

test('context is constrained to real or test and TEST clone/reset use isolated RPCs',async()=>{
  api.configure({isAdmin:true,activeRole:'admin'});
  assert.equal(api.setContext('test'),true);
  assert.equal(api.getContext(),'test');
  assert.equal(api.setContext('other'),false);
  assert.match(source,/v16_reset_test_context/);
  assert.match(source,/v16_clone_real_to_test/);
  assert.match(source,/v16:context-changed/);
});

test('preview compares teacher manipulation and room fields using real assignment ids',()=>{
  assert.match(source,/teacher_id,group_no,manipulation_code,room,test_session_id,real_assignment_id/);
  assert.match(source,/teacher_id,group_no,manipulation_code,room,session_id,id/);
  assert.match(source,/real_assignment_id/);
  assert.match(source,/realById/);
});

test('TEST to REAL keeps the compatibility RPC name',()=>{
  assert.match(source,/v16_apply_test_teacher_plan/);
});

test('apply UI includes preview summary and explicit confirmation',()=>{
  const html=api.render({isAdmin:true,activeRole:'admin'});
  for(const marker of ['Configuration actuelle','Configuration proposée','Date d’effet','Semaines','Anomalies','Appliquer au RÉEL'])assert.match(html,new RegExp(marker,'i'),marker);
  assert.match(html,/data-v16-apply-preview/);
  assert.match(html,/data-v16-apply-confirm/);
});
