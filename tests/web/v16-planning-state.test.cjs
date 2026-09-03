const test = require('node:test');
const assert = require('node:assert/strict');

const stateApi = require('../../web/v16-planning-state.js');

const rows = [
  {
    date:'2026-09-14', weekday:'monday', className:'MPI1-A', isTeachingSession:true,
    groups:[
      {groupNo:1, manipulation:'M1', room:'C'},
      {groupNo:2, manipulation:'M2', room:'B'},
      {groupNo:3, manipulation:'M3', room:'D'},
      {groupNo:4, manipulation:'M4', room:'D'}
    ]
  },
  {
    date:'2026-09-17', weekday:'thursday', className:'MPI1-C', isTeachingSession:true,
    groups:[
      {groupNo:1, manipulation:'M1', room:'C'},
      {groupNo:2, manipulation:'M2', room:'B'},
      {groupNo:3, manipulation:'M3', room:'D'},
      {groupNo:4, manipulation:'M4', room:'D'}
    ]
  },
  {
    date:'2026-09-21', weekday:'monday', className:'MPI1-E', isTeachingSession:true,
    groups:[
      {groupNo:1, manipulation:'M1', room:'C'},
      {groupNo:2, manipulation:'M2', room:'B'},
      {groupNo:3, manipulation:'M3', room:'D'},
      {groupNo:4, manipulation:'M4', room:'D'}
    ]
  }
];

const assignments = [
  {date:'2026-09-14', className:'MPI1-A', groupNo:2, teacherId:'t-olfa'},
  {date:'2026-09-14', className:'MPI1-A', groupNo:3, teacherId:'t-souhail'},
  {date:'2026-09-17', className:'MPI1-C', groupNo:3, teacherId:'t-souhail'},
  {date:'2026-09-21', className:'MPI1-E', groupNo:1, teacherId:'t-khaoula'}
];

const state = stateApi.createPlanningState(rows, assignments);

test('filters by class and group while keeping only matching posts', () => {
  const result = stateApi.filterPlanning(state, {className:'MPI1-A', groupNo:2});
  assert.equal(result.length, 1);
  assert.equal(result[0].className, 'MPI1-A');
  assert.deepEqual(result[0].groups.map(g => g.groupNo), [2]);
  assert.equal(result[0].groups[0].teacherId, 't-olfa');
});

test('combines weekday and manipulation filters', () => {
  const result = stateApi.filterPlanning(state, {weekday:'monday', manipulation:'M3'});
  assert.equal(result.length, 2);
  assert.ok(result.every(r => r.groups.length === 1));
  assert.ok(result.every(r => r.groups[0].manipulation === 'M3'));
});

test('filters teacher, room, ISO week and date range', () => {
  const byTeacher = stateApi.filterPlanning(state, {teacherId:'t-souhail'});
  assert.deepEqual(byTeacher.map(r => r.date), ['2026-09-14','2026-09-17']);
  assert.ok(byTeacher.every(r => r.groups.every(g => g.teacherId === 't-souhail')));

  const byRoom = stateApi.filterPlanning(state, {room:'C'});
  assert.equal(byRoom.length, 3);
  assert.ok(byRoom.every(r => r.groups.every(g => g.room === 'C')));

  const week38 = stateApi.filterPlanning(state, {week:'2026-W38'});
  assert.deepEqual(week38.map(r => r.date), ['2026-09-14','2026-09-17']);

  const ranged = stateApi.filterPlanning(state, {fromDate:'2026-09-17', toDate:'2026-09-21'});
  assert.deepEqual(ranged.map(r => r.date), ['2026-09-17','2026-09-21']);
});

test('planning summary counts visible teaching rows and assigned posts', () => {
  const filtered = stateApi.filterPlanning(state, {className:'MPI1-A'});
  assert.deepEqual(stateApi.planningSummary(filtered), {sessionCount:1, assignmentCount:2});
});
