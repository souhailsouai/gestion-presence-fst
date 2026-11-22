const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

function read(path){return fs.existsSync(path)?fs.readFileSync(path,'utf8'):'';}
const ui=read('web/v16-teacher-permutations.js');
const planning=read('web/v16-planning-ui.js');
const online=read('scripts/build_pages_from_41881.py');
const single=read('scripts/build_pages_from_41881.py');

test('legacy Admin permutation UI remains loadable for compatibility',()=>{
  for(const marker of [
    'Permuter','v16-swap-teacher-a','v16-swap-day-a','v16-swap-teacher-b','v16-swap-day-b',
    'v16-swap-scope','Cette semaine','Toutes les semaines futures','v16-swap-effective-date',
    'v16-swap-summary','v16-swap-confirm'
  ])assert.match(ui,new RegExp(marker,'i'),marker);
  assert.match(ui,/v16_swap_teachers/);
  assert.match(ui,/v16_verify_teacher_week/);
});

test('permutation module itself remains Admin-only but Planning now uses manual editor',()=>{
  assert.match(ui,/V16ActiveRole/);
  assert.match(ui,/canUseAdminControls/);
  assert.match(ui,/isAdmin/);
  assert.match(planning,/V16PlanningEditor/);
  assert.match(planning,/v16-manual-editor-root/);
  assert.doesNotMatch(planning,/v16-admin-permutations/);
  assert.doesNotMatch(planning,/V16TeacherPermutations/);
});

test('legacy permutation UI still contains its historical live policy summary',()=>{
  assert.match(ui,/4\s*\/\s*jour/i);
  assert.match(ui,/2\s*jours\s*\/\s*semaine/i);
  assert.match(ui,/addEventListener\(['"]change['"]/);
  assert.match(ui,/renderSummary/);
  assert.match(ui,/confirm/i);
});


