const test=require('node:test');
const assert=require('node:assert/strict');
const planning=require('../../web/v515-planning-core.js');

test('four-group M1-M6 rotation matches approved planning',()=>{
  assert.deepEqual([1,2,3,4].map(g=>planning.manipulationFor(g,1)),['M1','M2','M3','M4']);
  assert.deepEqual([1,2,3,4].map(g=>planning.manipulationFor(g,2)),['M2','M3','M4','M5']);
  assert.deepEqual([1,2,3,4].map(g=>planning.manipulationFor(g,6)),['M6','M1','M2','M3']);
});

test('group counts from 1 to 6 are supported',()=>{
  for(let count=1;count<=6;count++){
    const values=Array.from({length:count},(_,i)=>planning.manipulationFor(i+1,1));
    assert.equal(values.length,count);
    assert.equal(values[0],'M1');
  }
});

test('no-TP calendar rows do not consume pair alternation or rotation',()=>{
  const rows=[
    {date:'2026-09-14',isTeachingSession:true},
    {date:'2026-09-21',isTeachingSession:true},
    {date:'2026-09-28',isTeachingSession:true},
    {date:'2026-11-02',isTeachingSession:false,reason:'REPOS'},
    {date:'2026-11-09',isTeachingSession:true}
  ];
  const built=planning.buildEffectiveSessions(rows,['MPI1-A','MPI1-E']);
  assert.equal(built[0].className,'MPI1-A');
  assert.equal(built[1].className,'MPI1-E');
  assert.equal(built[2].className,'MPI1-A');
  assert.equal(built[3].effectiveSessionIndex,null);
  assert.equal(built[4].className,'MPI1-E');
  assert.equal(built[4].classOccurrence,2);
  assert.deepEqual(built[4].groups.map(x=>x.manipulation),['M2','M3','M4','M5']);
});

test('completeness identifies missing manipulations per group',()=>{
  const rows=[];
  for(let i=1;i<=11;i++)rows.push({date:`D${i}`,isTeachingSession:true});
  const sessions=planning.buildEffectiveSessions(rows,['A','B']);
  const c=planning.completeness(sessions,'B',4,6);
  assert.equal(c.complete,false);
  assert.deepEqual(c.groups[1].missing,['M6']);
  assert.deepEqual(c.groups[2].missing,['M1']);
  assert.deepEqual(c.groups[3].missing,['M2']);
  assert.deepEqual(c.groups[4].missing,['M3']);
});
