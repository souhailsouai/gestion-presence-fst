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

test('presence sheet renders an explicit message when the selected group has no students',()=>{
  const js=fs.readFileSync('web/session-editing.js','utf8');
  assert.match(js,/Aucun étudiant n(?:’|')est associé à ce groupe/);
});
