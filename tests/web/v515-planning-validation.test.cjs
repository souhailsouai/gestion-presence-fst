const test=require('node:test');
const assert=require('node:assert/strict');
const validation=require('../../web/v515-planning-validation.js');

test('incomplete cycles are warnings for publication',()=>{
  const plan={groupCount:4,manipulationCount:6,sessions:[],completeness:[{className:'MPI1-E',groups:[{groupNo:1,completed:5,missing:['M6'],duplicates:[]}]}],assignmentPosts:[],rotationConsistent:true};
  const r=validation.verify(plan);
  assert.equal(r.blockers.length,0);
  assert.equal(r.warnings[0].code,'INCOMPLETE_CYCLE');
  assert.equal(r.canPublish,true);
});

test('completed session mutation blocks publication',()=>{
  const plan={sessions:[{id:'s1',date:'2026-09-14',slot:'13:45-17:30',completedAt:'2026-09-14T17:30:00Z',pendingMutation:true,groups:[]}],completeness:[],assignmentPosts:[],rotationConsistent:true};
  const r=validation.verify(plan);
  assert.equal(r.blockers.some(x=>x.code==='COMPLETED_SESSION_MUTATION'),true);
  assert.equal(r.canPublish,false);
});

test('vacant posts warn at publication but block assignment finalization',()=>{
  const plan={sessions:[],completeness:[],assignmentPosts:[{id:'p1',teacherId:null}],rotationConsistent:true};
  const r=validation.verify(plan);
  assert.equal(r.blockers.length,0);
  assert.equal(r.warnings.some(x=>x.code==='VACANT_POST'),true);
  const f=validation.canFinalizeAssignments(r,plan);
  assert.equal(f.ok,false);
  assert.match(f.blockers.at(-1).message,/1 postes restent sans enseignant/);
});

test('quota, disallowed manipulation and time conflict block assignment lifecycle',()=>{
  const plan={sessions:[],completeness:[],rotationConsistent:true,assignmentPosts:[
    {id:'p1',teacherId:'t1',manipulation:'M4',quotaExceeded:true,manipulationAllowed:false,timeConflict:true}
  ]};
  const r=validation.verify(plan);
  assert.equal(r.blockers.some(x=>x.code==='TEACHER_QUOTA'),true);
  assert.equal(r.blockers.some(x=>x.code==='MANIPULATION_NOT_ALLOWED'),true);
  assert.equal(r.blockers.some(x=>x.code==='TEACHER_TIME_CONFLICT'),true);
});

test('cycle closure blocks missing M1-M6 unless explicitly waived',()=>{
  const plan={completeness:[{className:'PC1-A',groups:[{groupNo:1,completed:5,missing:['M6'],duplicates:[]}]}]};
  assert.equal(validation.canCloseCycle(plan).ok,false);
  assert.equal(validation.canCloseCycle(plan,[{className:'PC1-A',groupNo:1,manipulation:'M6'}]).ok,true);
});
