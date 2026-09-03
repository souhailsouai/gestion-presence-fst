const test = require('node:test');
const assert = require('node:assert/strict');

const data = require('../../web/v16-planning-data.js');

function row(date) {
  return data.rows().find(x => x.date === date);
}

test('V16 official adapter preserves the Monday rotation and fixed rooms', () => {
  const first = row('2026-09-14');
  assert.equal(first.className, 'MPI1-A');
  assert.equal(first.weekday, 'monday');
  assert.equal(first.start, '13:45');
  assert.equal(first.end, '17:30');
  assert.deepEqual(first.groups, [
    {groupNo: 1, manipulation: 'M1', room: 'C'},
    {groupNo: 2, manipulation: 'M2', room: 'B'},
    {groupNo: 3, manipulation: 'M3', room: 'D'},
    {groupNo: 4, manipulation: 'M4', room: 'D'}
  ]);

  const third = row('2026-09-28');
  assert.equal(third.className, 'MPI1-A');
  assert.deepEqual(third.groups.map(x => x.manipulation), ['M2', 'M3', 'M4', 'M5']);
  assert.deepEqual(third.groups.map(x => x.room), ['B', 'D', 'D', 'A']);
});

test('V16 treats 15 October as a normal Thursday TP session and advances the alternation', () => {
  const holiday = row('2026-10-15');
  assert.equal(holiday.isTeachingSession, true);
  assert.equal(holiday.className, 'MPI1-C');
  assert.equal(holiday.reason, null);
  assert.deepEqual(holiday.groups.map(x => x.manipulation), ['M3', 'M4', 'M5', 'M6']);
  assert.deepEqual(holiday.groups.map(x => x.room), ['D', 'D', 'A', 'A']);

  const nextThursday = row('2026-10-22');
  assert.equal(nextThursday.className, 'MPI1-D');
  assert.deepEqual(nextThursday.groups.map(x => x.manipulation), ['M3', 'M4', 'M5', 'M6']);

  const rest = row('2026-11-05');
  assert.equal(rest.isTeachingSession, false);
  assert.equal(rest.reason, 'REPOS');
  assert.deepEqual(rest.groups, []);
});

test('V16 room mapping is immutable and complete', () => {
  assert.deepEqual(data.manipulationRooms, {M1:'C', M2:'B', M3:'D', M4:'D', M5:'A', M6:'A'});
});
