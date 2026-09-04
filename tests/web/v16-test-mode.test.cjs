const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path='web/v16-test-mode.js';
const source=fs.existsSync(path)?fs.readFileSync(path,'utf8'):'';
let api=null;
try{api=require('../../web/v16-test-mode.js');}catch(_){api=null;}

function queryResult(data,{single=false}={}){
  const q={
    select(){return q;},
    eq(){return q;},
    is(){return q;},
    in(){return q;},
    order(){return q;},
    maybeSingle:async()=>({data:single?(Array.isArray(data)?data[0]??null:data):data,error:null}),
    then(resolve,reject){return Promise.resolve({data:Array.isArray(data)?data:(data==null?[]:[data]),error:null}).then(resolve,reject);}
  };
  return q;
}

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
  const client={from(name){return queryResult(tables[name]||[]);}};
  api.configure({isAdmin:true,activeRole:'admin',supabaseClient:client,context:'test'});
  const preview=await api.previewApply('2026-10-01');
  assert.equal(preview.current_count,1);
  assert.equal(preview.proposed_count,1);
  assert.equal(preview.structural_changes,1);
  assert.equal(preview.weeks,1);
});

test('preview reports weekly teacher-distribution blockers before TEST to REAL apply',async()=>{
  const sessions=[
    {id:'ts-mon',real_session_id:'rs-mon',session_date:'2026-09-14',class_name:'MPI1-A'},
    {id:'ts-thu',real_session_id:'rs-thu',session_date:'2026-09-17',class_name:'MPI1-C'},
    {id:'ts-fri',real_session_id:'rs-fri',session_date:'2026-09-18',class_name:'MPI1-B'}
  ];
  const assignments=[];
  for(const [sessionIndex,session] of sessions.entries()){
    for(let group=1;group<=4;group++)assignments.push({
      test_session_id:session.id,
      real_assignment_id:`ra-${sessionIndex}-${group}`,
      group_no:group,
      teacher_id:`t${group}`,
      manipulation_code:`M${group}`,
      room:['A','B','C','D'][group-1]
    });
  }
  const tables={
    v515_cycles:[{id:'cycle-1'}],
    v515_teacher_constraints:[1,2,3,4,5,6].map(n=>({teacher_id:`t${n}`,cycle_id:'cycle-1'})),
    v16_test_sessions:sessions,
    v16_test_assignments:assignments,
    v515_sessions:sessions.map(s=>({id:s.real_session_id,session_date:s.session_date,class_name:s.class_name,is_teaching_session:true})),
    v515_assignments:assignments.map((a,index)=>({id:a.real_assignment_id,session_id:sessions[Math.floor(index/4)].real_session_id,group_no:a.group_no,teacher_id:a.teacher_id,manipulation_code:a.manipulation_code,room:a.room}))
  };
  const client={from(name){return queryResult(tables[name]||[],{single:name==='v515_cycles'});}};
  api.configure({isAdmin:true,activeRole:'admin',supabaseClient:client,context:'test'});
  const preview=await api.previewApply('2026-09-14');
  assert.equal(preview.weeks,1);
  assert.ok(preview.blockers.length>0);
  assert.ok(preview.blockers.some(b=>['MAX_TWO_DAYS_PER_TEACHER','TEACHER_WEEKDAY_COUNT'].includes(b.code)));
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

test('TEST to REAL keeps the compatibility RPC name',()=>{
  assert.match(source,/v16_apply_test_teacher_plan/);
});

test('apply UI includes preview summary and explicit confirmation',()=>{
  const html=api.render({isAdmin:true,activeRole:'admin'});
  for(const marker of ['Configuration actuelle','Configuration proposée','Date d’effet','Semaines','Anomalies','Appliquer au RÉEL'])assert.match(html,new RegExp(marker,'i'),marker);
  assert.match(html,/data-v16-apply-preview/);
  assert.match(html,/data-v16-apply-confirm/);
});
