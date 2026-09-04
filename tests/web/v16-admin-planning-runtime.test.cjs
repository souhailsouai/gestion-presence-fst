const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const fixes=fs.readFileSync('web/online-fixes.js','utf8');
const permutations=fs.readFileSync('web/v16-teacher-permutations.js','utf8');

test('V16 login derives Admin capability from the authoritative profile role and current teacher',()=>{
  assert.match(fixes,/profile\?\.role\s*===\s*['"]admin['"]/);
  assert.match(fixes,/currentTeacher\?\.isAdmin/);
});

test('V16 reinitializes planning and TEST controls after login and when opening Planning',()=>{
  assert.match(fixes,/V16PlanningUI\?\.init/);
  assert.match(fixes,/tabName\s*===\s*['"]planning-v16['"][\s\S]*V16PlanningUI\?\.init/);
  assert.match(fixes,/mountV16TestMode\(\)/);
});

test('teacher permutation Admin visibility follows the V16 active-role authority',()=>{
  assert.match(permutations,/V16ActiveRole/);
  assert.match(permutations,/canUseAdminControls/);
});
