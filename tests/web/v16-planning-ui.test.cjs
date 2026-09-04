const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

function read(path){return fs.existsSync(path)?fs.readFileSync(path,'utf8'):'';}

const ui=read('web/v16-planning-ui.js');
const online=read('scripts/build_online_web.py');
const single=read('scripts/build_single_file_release.py');

test('V16 planning UI exposes all approved interactive filters and counters',()=>{
  for(const marker of [
    'v16-filter-class','v16-filter-group','v16-filter-weekday','v16-filter-week',
    'v16-filter-teacher','v16-filter-manipulation','v16-filter-room',
    'v16-filter-from','v16-filter-to','v16-session-count','v16-assignment-count',
    'v16-planning-table-body'
  ])assert.match(ui,new RegExp(marker),marker);
  assert.match(ui,/addEventListener\(['"]change['"]/);
  assert.match(ui,/filterPlanning/);
  assert.match(ui,/planningSummary/);
});

test('V16 planning UI has explicit loading, empty and error states',()=>{
  assert.match(ui,/Chargement du planning/i);
  assert.match(ui,/Aucune séance ne correspond/i);
  assert.match(ui,/Erreur de chargement/i);
});

test('V16 auto-init reads V5.13 lexical Supabase and teacher globals, not only window properties',()=>{
  assert.match(ui,/function runtimeClient\(\)/);
  assert.match(ui,/typeof supabaseClient/);
  assert.match(ui,/function runtimeTeacher\(\)/);
  assert.match(ui,/typeof currentTeacher/);
  assert.match(ui,/supabaseClient:runtimeClient\(\)/);
  assert.match(ui,/currentTeacher:runtimeTeacher\(\)/);
});

test('planning loader reads all persisted structural fields and TEST context',()=>{
  assert.match(ui,/session_id,group_no,teacher_id,manipulation_code,room/);
  assert.match(ui,/v16_test_assignments/);
  assert.match(ui,/v16_test_sessions/);
  assert.match(ui,/V16TestMode/);
});

test('teacher selector is restricted to the six teachers configured for the active cycle',()=>{
  assert.match(ui,/v515_teacher_constraints/);
  assert.match(ui,/teacher_id/);
  assert.match(ui,/allowedTeacherIds|allowedIds|allowed/i);
});

test('manual editor supersedes permutation panel when available',()=>{
  assert.match(ui,/V16PlanningEditor/);
  assert.match(ui,/editorApi/);
  assert.match(ui,/editorApi\?\.render|editorApi\.render/);
  assert.doesNotMatch(ui,/permutationsApi\?\.render\(/);
});

test('V16 build bundles V16 modules in dependency order and excludes old floating UI',()=>{
  const modules=['v515-planning-core.js','v515-planning-2026-2027.js','v16-planning-data.js','v16-planning-state.js','v16-planning-ui.js'];
  let last=-1;
  for(const m of modules){const pos=online.indexOf(m);assert.ok(pos>last,m);last=pos;}
  assert.equal(online.includes('v515-planning-ui.js'),false);
  assert.equal(online.includes('v515-planning-admin-actions.js'),false);
});

test('standalone V16 build inlines native planning modules',()=>{
  for(const marker of [
    'data-fst-v16-planning-data','data-fst-v16-planning-state','data-fst-v16-planning-ui',
    'V16PlanningData','V16PlanningState','V16PlanningUI'
  ])assert.match(single,new RegExp(marker),marker);
  assert.doesNotMatch(single,/<script data-fst-v515-planning-ui/);
  assert.doesNotMatch(single,/<script data-fst-v515-planning-admin/);
});
