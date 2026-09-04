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

test('preview uses the read-only server preflight as the authoritative TEST to REAL check',async()=>{
  const calls=[];
  const expected={ok:false,effective_date:'2026-10-01',current_count:8,proposed_count:8,structural_changes:2,weeks:2,blockers:[{code:'SESSION_ALREADY_STARTED'}],warnings:[]};
  const client={rpc:async(name,args)=>{calls.push({name,args});return {data:expected,error:null};}};
  api.configure({isAdmin:true,activeRole:'admin',supabaseClient:client,context:'test'});
  const preview=await api.previewApply('2026-10-01');
  assert.deepEqual(calls,[{name:'v16_preview_test_apply',args:{p_effective_date:'2026-10-01'}}]);
  assert.deepEqual(preview,expected);
});

test('preview returns server counts and blockers without local recomputation',async()=>{
  const expected={ok:false,effective_date:'2026-09-14',current_count:12,proposed_count:12,structural_changes:4,weeks:1,blockers:[{code:'TEST_WEEK_VALIDATION_FAILED',details:[{code:'MAX_TWO_DAYS_PER_TEACHER'}]}],warnings:[]};
  const client={rpc:async()=>({data:expected,error:null})};
  api.configure({isAdmin:true,activeRole:'admin',supabaseClient:client,context:'test'});
  assert.deepEqual(await api.previewApply('2026-09-14'),expected);
});

test('preview rejects missing dates and propagates server errors',async()=>{
  const error=new Error('preview unavailable');
  const client={rpc:async()=>({data:null,error})};
  api.configure({isAdmin:true,activeRole:'admin',supabaseClient:client,context:'test'});
  await assert.rejects(()=>api.previewApply(''),/Date d’effet requise/);
  await assert.rejects(()=>api.previewApply('2026-09-14'),/preview unavailable/);
});

test('TEST to REAL keeps separate preview and apply RPCs',()=>{
  assert.match(source,/v16_preview_test_apply/);
  assert.match(source,/v16_apply_test_teacher_plan/);
});

test('apply UI includes preview summary and explicit confirmation',()=>{
  const html=api.render({isAdmin:true,activeRole:'admin'});
  for(const marker of ['Configuration actuelle','Configuration proposée','Date d’effet','Semaines','Anomalies','Appliquer au RÉEL'])assert.match(html,new RegExp(marker,'i'),marker);
  assert.match(html,/data-v16-apply-preview/);
  assert.match(html,/data-v16-apply-confirm/);
});

test('apply confirmation remains disabled when server preview is not ok or has blockers',()=>{
  assert.match(source,/confirm\.disabled=!p\.ok\|\|Boolean\(blockers\.length\)/);
  assert.match(source,/confirm\.disabled=true/);
});
