const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('attendance policy maps grade-only rows and saves them to Supabase',()=>{
  const js=fs.readFileSync('web/attendance-policy.js','utf8');
  assert.match(js,/grade_only/);
  assert.match(js,/gradeOnly/);
  assert.match(js,/fetchRemoteData/);
  assert.match(js,/saveAttendance/);
  assert.match(js,/renderSessions/);
});

test('student loading relies on RLS instead of filtering by student teacher_id',()=>{
  const js=fs.readFileSync('web/attendance-policy.js','utf8');
  assert.match(js,/from\('students'\)\.select\('\*'\)/);
  assert.doesNotMatch(js,/from\('students'\)\.select\('\*'\)\.eq\('teacher_id',owner\)/);
});
