const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('Web build includes V5.15 API in external and standalone builds',()=>{
  for(const p of ['scripts/build_online_web.py','scripts/build_single_file_release.py']) assert.equal(fs.existsSync(p),true,p);
  const online=fs.readFileSync('scripts/build_online_web.py','utf8');
  const single=fs.readFileSync('scripts/build_single_file_release.py','utf8');
  assert.match(online,/\.\/v515-api\.js/);
  assert.match(single,/v515_api_path/);
  assert.match(single,/data-fst-v515-api="inline"/);
  assert.match(single,/window\.FSTV515Api=/);
});

test('Web build includes V5.15 teacher UI',()=>{
  const online=fs.readFileSync('scripts/build_online_web.py','utf8');
  const single=fs.readFileSync('scripts/build_single_file_release.py','utf8');
  assert.match(online,/\.\/v515-teacher-ui\.js/);
  assert.match(single,/v515_teacher_ui_path/);
  assert.match(single,/data-fst-v515-teacher-ui="inline"/);
  assert.match(single,/window\.FSTV515TeacherUI=/);
});

test('Web build includes V5.15 administrator UI',()=>{
  const online=fs.readFileSync('scripts/build_online_web.py','utf8');
  const single=fs.readFileSync('scripts/build_single_file_release.py','utf8');
  assert.match(online,/\.\/v515-admin-ui\.js/);
  assert.match(single,/v515_admin_ui_path/);
  assert.match(single,/data-fst-v515-admin-ui="inline"/);
  assert.match(single,/window\.FSTV515AdminUI=/);
});

test('Web build includes V5.15 authenticated realtime runtime',()=>{
  const online=fs.readFileSync('scripts/build_online_web.py','utf8');
  const single=fs.readFileSync('scripts/build_single_file_release.py','utf8');
  assert.match(online,/\.\/v515-runtime\.js/);
  assert.match(single,/v515_runtime_path/);
  assert.match(single,/data-fst-v515-runtime="inline"/);
  assert.match(single,/window\.FSTV515=/);
});
