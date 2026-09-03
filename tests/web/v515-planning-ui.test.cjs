const fs=require('node:fs');
const test=require('node:test');
const assert=require('node:assert/strict');

const ui=fs.readFileSync('web/v515-planning-ui.js','utf8');
const admin=fs.readFileSync('web/v515-planning-admin-actions.js','utf8');
const online=fs.readFileSync('scripts/build_online_web.py','utf8');
const single=fs.readFileSync('scripts/build_single_file_release.py','utf8');

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

test('Admin assignment UI derives the fixed PDF room from manipulation and only changes teacher choice',()=>{
  assert.match(admin,/manipulationRooms/);
  assert.match(admin,/M1:'C'/);
  assert.match(admin,/M2:'B'/);
  assert.match(admin,/M3:'D'/);
  assert.match(admin,/M4:'D'/);
  assert.match(admin,/M5:'A'/);
  assert.match(admin,/M6:'A'/);
  assert.doesNotMatch(admin,/v515-direct-room/);
  assert.doesNotMatch(admin,/roomSelect\(/);
  assert.match(admin,/p_room:row\.room/);
  assert.match(admin,/Activer dans présence/);
});

test('online build loads V5.15 modules in dependency order',()=>{
  const modules=['v515-planning-core.js','v515-planning-2026-2027.js','v515-planning-validation.js','v515-planning-ui.js','v515-planning-admin-actions.js'];
  let last=-1;for(const m of modules){const pos=online.indexOf(m);assert.ok(pos>last,m);last=pos;}
});

test('standalone build inlines V5.15 modules and asserts final markers',()=>{
  for(const marker of ['data-fst-v515-planning-core','data-fst-v515-planning-data','data-fst-v515-planning-validation','data-fst-v515-planning-ui','data-fst-v515-planning-admin','V515PlanningUI','V515PlanningAdminActions'])assert.match(single,new RegExp(marker));
});
