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

test('teacher and admin V5.15 actions call server RPCs',()=>{
  for(const rpc of ['v515_initialize_2026_2027','v515_publish_cycle','v515_finalize_assignments','v515_set_group_count','v515_set_teacher_constraints','v515_request_assignment','v515_cancel_request'])assert.match(ui,new RegExp(rpc),rpc);
  for(const rpc of ['v515_validate_request','v515_assign_teacher','v515_materialize_session_plans'])assert.match(admin,new RegExp(rpc),rpc);
});

test('Admin assignment UI requires a room for validation and direct assignment',()=>{
  assert.match(admin,/p_room:room/);
  assert.match(admin,/v515-direct-room/);
  assert.match(admin,/Salle A/);
  assert.match(admin,/Activer dans présence/);
});

test('online build loads V5.15 modules in dependency order',()=>{
  const modules=['v515-planning-core.js','v515-planning-2026-2027.js','v515-planning-validation.js','v515-planning-ui.js','v515-planning-admin-actions.js'];
  let last=-1;for(const m of modules){const pos=online.indexOf(m);assert.ok(pos>last,m);last=pos;}
});

test('standalone build inlines V5.15 modules and asserts final markers',()=>{
  for(const marker of ['data-fst-v515-planning-core','data-fst-v515-planning-data','data-fst-v515-planning-validation','data-fst-v515-planning-ui','data-fst-v515-planning-admin','V515PlanningUI','V515PlanningAdminActions'])assert.match(single,new RegExp(marker));
});
