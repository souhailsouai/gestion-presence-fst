const fs=require('node:fs');
const test=require('node:test');
const assert=require('node:assert/strict');

const ui=fs.readFileSync('web/v515-planning-ui.js','utf8');
const admin=fs.readFileSync('web/v515-planning-admin-actions.js','utf8');
const online=fs.readFileSync('scripts/build_pages_from_41881.py','utf8');
const single=fs.readFileSync('scripts/build_pages_from_41881.py','utf8');

test('V5.15 UI does not replace V5.13 attendance or grade functions',()=>{
  const combined=ui+'\n'+admin;
  assert.doesNotMatch(combined,/window\.loadPresenceSheet\s*=/);
  assert.doesNotMatch(combined,/window\.updateAttendanceGrade\s*=/);
  assert.doesNotMatch(combined,/window\.updateAttendance\s*=/);
});

test('V5.15 assignment is Admin-only: teachers cannot request or cancel planning posts',()=>{
  assert.doesNotMatch(ui,/v515_request_assignment/);
  assert.doesNotMatch(ui,/v515_cancel_request/);
  assert.doesNotMatch(admin,/v515_validate_request/);
  assert.doesNotMatch(admin,/Demandes en attente/);
  assert.match(ui,/affectations sont définies par l.administrateur/i);
  for(const rpc of ['v515_initialize_2026_2027','v515_publish_cycle','v515_finalize_assignments'])assert.match(ui,new RegExp(rpc),rpc);
  for(const rpc of ['v515_assign_teacher','v515_materialize_session_plans'])assert.match(admin,new RegExp(rpc),rpc);
});

test('Admin arrangement uses the PDF day pool and started plans are visibly locked',()=>{
  assert.match(ui,/from\('v515_teacher_day_pool'\)/);
  assert.match(ui,/from\('session_plans'\)/);
  assert.match(admin,/teacherPool/);
  assert.match(admin,/data-v515-direct-assign/);
  assert.match(admin,/Modifier/);
  assert.match(admin,/Séance démarrée/);
  assert.match(admin,/disabled/);
});

