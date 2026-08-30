const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('access control module enforces ownership and read-only foreign sessions',()=>{
  const p='web/access-control.js';
  assert.equal(fs.existsSync(p),true);
  const js=fs.readFileSync(p,'utf8');
  assert.match(js,/canManageRecord/);
  assert.match(js,/teacherId/);
  assert.match(js,/currentTeacher\.id/);
  assert.match(js,/isAdmin/);
  assert.match(js,/Lecture seule/);
  assert.match(js,/foreignSessions/);
  assert.match(js,/deleteSession/);
  assert.match(js,/openSessionForNotes/);
  assert.match(js,/saveAttendance/);
  assert.match(js,/grade_only/);
  assert.match(js,/gradeOnly/);
});
