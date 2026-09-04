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

test('successful RÉEL to TEST clone emits a context refresh event',()=>{
  const clone=source.match(/async function cloneRealToTest[\s\S]*?\n  }/)?.[0]||'';
  assert.match(clone,/emit\(\)/);
});

test('preview compares teacher manipulation and room fields using real assignment ids',()=>{
  assert.match(source,/teacher_id,group_no,manipulation_code,room,test_session_id,real_assignment_id/);
  assert.match(source,/teacher_id,group_no,manipulation_code,room,session_id,id/);
  assert.match(source,/real_assignment_id/);
  assert.match(source,/realById/);
});

test('preview scopes counts and structural changes to the requested effective date',async()=>{
  const tables={
    v16_test_assignments:[
      {test_session_id:'ts-before',real_assignment_id:'r-before',group_no:1,teacher_id:'t1',manipulation_code:'M1',room:'A'},
      {test_session_id:'ts-after',real_assignment_id:'r-after',group_no:1,teacher_id:'t2-new',manipulation_code:'M2',room:'B'}
    ],
    v16_test_sessions:[
      {id:'ts-before',session_date:'2026-09-20'},
      {id:'ts-after',session_date:'2026-10-05'}
    ],
    v515_assignments:[
      {id:'r-before',session_id:'rs-before',group_no:1,teacher_id:'t1',manipulation_code:'M1',room:'A'},
      {id:'r-after',session_id:'rs-after',group_no:1,teacher_id:'t2-old',manipulation_code:'M2',room:'B'}
    ]
  };
  const client={from(name){return {select:async()=>({data:tables[name]||[],error:null})};}};
  api.configure({isAdmin:true,activeRole:'admin',supabaseClient:client,context:'test'});
  const preview=await api.previewApply('2026-10-01');
  assert.equal(preview.current_count,1);
  assert.equal(preview.proposed_count,1);
  assert.equal(preview.structural_changes,1);
  assert.equal(preview.weeks,1);
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
