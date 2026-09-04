const test = require('node:test');
const assert = require('node:assert/strict');

const stateApi = require('../../web/v16-planning-state.js');

const rows = [
  {
    date:'2026-09-14', weekday:'monday', className:'MPI1-A', isTeachingSession:true,
    groups:[
      {groupNo:1, manipulation:'M1', room:null},
      {groupNo:2, manipulation:'M2', room:null},
      {groupNo:3, manipulation:'M3', room:null},
      {groupNo:4, manipulation:'M4', room:null}
    ]
  },
  {
    date:'2026-09-17', weekday:'thursday', className:'MPI1-C', isTeachingSession:true,
    groups:[
      {groupNo:1, manipulation:'M1', room:null},
      {groupNo:2, manipulation:'M2', room:null},
      {groupNo:3, manipulation:'M3', room:null},
      {groupNo:4, manipulation:'M4', room:null}
    ]
  },
  {
    date:'2026-09-21', weekday:'monday', className:'MPI1-E', isTeachingSession:true,
    groups:[
      {groupNo:1, manipulation:'M1', room:null},
      {groupNo:2, manipulation:'M2', room:null},
      {groupNo:3, manipulation:'M3', room:null},
      {groupNo:4, manipulation:'M4', room:null}
    ]
  }
];

const assignments = [
  {date:'2026-09-14', className:'MPI1-A', groupNo:2, sessionId:'s-mon', teacherId:'t-olfa', manipulation:'M5', room:'B'},
  {date:'2026-09-14', className:'MPI1-A', groupNo:3, sessionId:'s-mon', teacherId:'t-souhail', manipulation:'M6', room:'C'},
  {date:'2026-09-17', className:'MPI1-C', groupNo:3, sessionId:'s-thu', teacherId:'t-souhail', manipulation:'M3', room:'D'},
  {date:'2026-09-21', className:'MPI1-E', groupNo:1, sessionId:'s-next', teacherId:'t-khaoula', manipulation:'M1', room:'A'}
];

const state = stateApi.createPlanningState(rows, assignments);

test('structural persisted values override seed independently',()=>{
  const g2=state.rows[0].groups[1];
  assert.equal(g2.sessionId,'s-mon');
  assert.equal(g2.teacherId,'t-olfa');
  assert.equal(g2.manipulation,'M5');
  assert.equal(g2.room,'B');
  assert.equal(state.rows[0].groups[0].manipulation,'M1');
  assert.equal(state.rows[0].groups[0].room,null);
});

test('filters by class and group while keeping only matching posts', () => {
  const result = stateApi.filterPlanning(state, {className:'MPI1-A', groupNo:2});
  assert.equal(result.length, 1);
  assert.equal(result[0].className, 'MPI1-A');
  assert.deepEqual(result[0].groups.map(g => g.groupNo), [2]);
  assert.equal(result[0].groups[0].teacherId, 't-olfa');
});

test('combines weekday and manipulation filters', () => {
  const result = stateApi.filterPlanning(state, {weekday:'monday', manipulation:'M1'});
  assert.deepEqual(result.map(r=>r.date),['2026-09-14','2026-09-21']);
  assert.ok(result.every(r=>r.groups.every(g=>g.manipulation==='M1')));
});

test('filters teacher, room, ISO week and date range', () => {
  const byTeacher = stateApi.filterPlanning(state, {teacherId:'t-souhail'});
  assert.deepEqual(byTeacher.map(r => r.date), ['2026-09-14','2026-09-17']);
  const byRoom = stateApi.filterPlanning(state, {room:'B'});
  assert.deepEqual(byRoom.map(r=>r.date),['2026-09-14']);
  const week38 = stateApi.filterPlanning(state, {week:'2026-W38'});
  assert.deepEqual(week38.map(r => r.date), ['2026-09-14','2026-09-17']);
  const ranged = stateApi.filterPlanning(state, {fromDate:'2026-09-17', toDate:'2026-09-21'});
  assert.deepEqual(ranged.map(r => r.date), ['2026-09-17','2026-09-21']);
});

test('planning summary counts visible teaching rows and assigned posts', () => {
  const filtered = stateApi.filterPlanning(state, {className:'MPI1-A'});
  assert.deepEqual(stateApi.planningSummary(filtered), {sessionCount:1, assignmentCount:2});
});

function teachingRow(date,className,teachers,manips=['M1','M2','M3','M4'],rooms=['A','B','C','D']){
  return {date,className,isTeachingSession:true,groups:teachers.map((teacherId,i)=>({groupNo:i+1,teacherId,manipulation:manips[i],room:rooms[i]}))};
}
const allTeachers=['t1','t2','t3','t4','t5','t6'];

test('normal three-day teacher distribution 2,2,2,2,2,2 is valid',()=>{
  const week=[
    teachingRow('2026-09-14','A',['t1','t2','t3','t4']),
    teachingRow('2026-09-17','C',['t1','t2','t5','t6']),
    teachingRow('2026-09-18','B',['t3','t4','t5','t6'])
  ];
  assert.equal(stateApi.validateWeek(week,allTeachers).ok,true);
});

test('holiday two-day distribution 2,2,1,1,1,1 is valid',()=>{
  const week=[
    teachingRow('2026-10-12','A',['t1','t2','t3','t4']),
    teachingRow('2026-10-16','B',['t1','t2','t5','t6'])
  ];
  assert.equal(stateApi.validateWeek(week,allTeachers).ok,true);
});

test('teacher on three days is blocked',()=>{
  const week=[
    teachingRow('2026-09-14','A',['t1','t2','t3','t4']),
    teachingRow('2026-09-17','C',['t1','t2','t5','t6']),
    teachingRow('2026-09-18','B',['t1','t4','t5','t6'])
  ];
  const result=stateApi.validateWeek(week,allTeachers);
  assert.equal(result.ok,false);
  assert.ok(result.blockers.some(b=>b.code==='MAX_TWO_DAYS_PER_TEACHER'));
});

test('duplicate room within one session is blocked',()=>{
  const row=teachingRow('2026-09-14','A',['t1','t2','t3','t4'],undefined,['A','A','C','D']);
  const result=stateApi.validateWeek([row],allTeachers,{skipTeacherDistribution:true});
  assert.ok(result.blockers.some(b=>b.code==='ROOM_TIME_CONFLICT'));
});

test('repeated manipulation for the same class and group is blocked',()=>{
  const history=[
    teachingRow('2026-09-14','MPI1-A',['t1','t2','t3','t4'],['M1','M2','M3','M4']),
    teachingRow('2026-09-28','MPI1-A',['t1','t2','t3','t4'],['M1','M3','M4','M5'])
  ];
  const blockers=stateApi.validateManipulationHistory(history);
  assert.ok(blockers.some(b=>b.code==='REPEATED_GROUP_MANIPULATION'&&b.groupNo===1));
});
