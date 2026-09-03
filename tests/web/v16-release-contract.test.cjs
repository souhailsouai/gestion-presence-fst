const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const cp=require('node:child_process');

function build(){
  cp.execFileSync('python',['scripts/build_online_web.py'],{stdio:'pipe'});
  return fs.readFileSync('web/index.html','utf8');
}
function navText(html){
  const block=html.match(/<!-- Navigation -->([\s\S]*?)<!-- Contenu -->/i)?.[1]||'';
  return [...block.matchAll(/<button[^>]*class="nav-tab[^\"]*"[^>]*>([\s\S]*?)<\/button>/gi)].map(m=>m[1].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim());
}

test('final V16 artifact is explicitly versioned and keeps approved navigation',()=>{
  const html=build();
  assert.match(html,/data-app-version="V16"/);
  assert.deepEqual(navText(html),['Dashboard','Présence','Classes & Groupes','Emploi du temps','Étudiants','Séances','Planning des séances','Rapports','Administration']);
  assert.match(html,/id="planning-v16" class="tab-content"/);
});

test('final online artifact bundles all V16 functional modules and no floating V5.15 UI',()=>{
  const html=build();
  for(const src of [
    'v16-active-role.js','v16-test-mode.js','v16-planning-data.js','v16-planning-state.js',
    'v16-teacher-permutations.js','v16-student-groups.js','v16-timetable-presence-link.js',
    'v16-planning-export-model.js','v16-planning-pdf.js','v16-planning-xlsx.js','v16-planning-ui.js'
  ])assert.match(html,new RegExp(`<script src="\\./${src.replaceAll('.','\\.')}"`),src);
  assert.doesNotMatch(html,/data-fst-v515-planning-ui|v515-launcher|Planning V5\.15/);
});

test('teacher active role renders no TEST controls in release modules',()=>{
  const role=require('../../web/v16-active-role.js');
  const testMode=require('../../web/v16-test-mode.js');
  role.configure({isAdmin:false,initialRole:'teacher'});
  testMode.configure({isAdmin:false,activeRole:'teacher'});
  assert.equal(role.canUseTestMode(),false);
  assert.equal(testMode.render({isAdmin:false,activeRole:'teacher'}),'');
});
