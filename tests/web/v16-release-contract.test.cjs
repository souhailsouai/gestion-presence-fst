const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const cp=require('node:child_process');

function build(){
  cp.execFileSync('python',['scripts/build_online_web.py'],{stdio:'pipe'});
  return fs.readFileSync('web/index.html','utf8');
}
function buildStandalone(){
  cp.execFileSync('python',['scripts/build_online_web.py'],{stdio:'pipe'});
  cp.execFileSync('python',['scripts/build_single_file_release.py'],{stdio:'pipe'});
  return fs.readFileSync('web/index.html','utf8');
}
const {navEntries,NAV_LABELS}=require('./fst-shell-test-helpers.cjs');

test('final artifact preserves internal metadata and approved shared navigation',()=>{
  const html=build();
  assert.match(html,/data-app-version="V16"/);
  assert.deepEqual(navEntries(html).map(x=>x.text),NAV_LABELS);
  assert.match(html,/id="planning-v16" class="tab-content"/);
});

test('final online artifact bundles all V16 functional modules and no floating V5.15 UI',()=>{
  const html=build();
  for(const src of [
    'v16-active-role.js','v16-test-mode.js','v16-planning-data.js','v16-planning-state.js',
    'v16-teacher-permutations.js','v16-student-groups.js','v16-timetable-presence-link.js',
    'v16-planning-export-model.js','v16-planning-pdf.js','v16-planning-xlsx.js',
    'v16-planning-editor.js','v16-dashboard-notices.js','v16-planning-ui.js'
  ])assert.match(html,new RegExp(`<script src="\\./${src.replaceAll('.','\\.')}"`),src);
  assert.doesNotMatch(html,/data-fst-v515-planning-ui|v515-launcher|Planning V5\.15/);
});

test('standalone release inlines manual editor and dashboard notices',()=>{
  const html=buildStandalone();
  assert.match(html,/data-fst-v16-planning-editor="inline"/);
  assert.match(html,/data-fst-v16-dashboard-notices="inline"/);
  assert.match(html,/V16PlanningEditor/);
  assert.match(html,/V16DashboardNotices/);
  assert.match(html,/13h30/);
  assert.doesNotMatch(html,/<script[^>]+src=["']\.\/v16-planning-editor\.js/);
  assert.doesNotMatch(html,/<script[^>]+src=["']\.\/v16-dashboard-notices\.js/);
});

test('teacher active role renders no TEST controls in release modules',()=>{
  const role=require('../../web/v16-active-role.js');
  const testMode=require('../../web/v16-test-mode.js');
  role.configure({isAdmin:false,initialRole:'teacher'});
  testMode.configure({isAdmin:false,activeRole:'teacher'});
  assert.equal(role.canUseTestMode(),false);
  assert.equal(testMode.render({isAdmin:false,activeRole:'teacher'}),'');
});
