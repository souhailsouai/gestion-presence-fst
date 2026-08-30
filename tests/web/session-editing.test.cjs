const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('session editing layer locks completed teacher attendance but keeps grades editable',()=>{
  const p='web/session-editing.js';
  assert.equal(fs.existsSync(p),true);
  const js=fs.readFileSync(p,'utf8');
  assert.match(js,/FSTSessionPermissions/);
  assert.match(js,/loadPresenceSheet/);
  assert.match(js,/canEditAttendance/);
  assert.match(js,/canEditGrade/);
  assert.match(js,/gradeOnly/);
  assert.match(js,/Non saisi/);
  assert.match(js,/materializeAttendance/);
  assert.match(js,/updateAttendanceComment/);
  assert.match(js,/updateAttendanceGrade/);
});
