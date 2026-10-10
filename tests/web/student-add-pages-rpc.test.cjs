const fs=require('node:fs');
const test=require('node:test');
const assert=require('node:assert/strict');

test('Pages build loads student RPC override after legacy baseline',()=>{
  const build=fs.readFileSync('scripts/build_pages_from_41881.py','utf8');
  assert.match(build,/v30-student-add-rpc-fix\.js/);
});

test('student RPC override never writes students directly',()=>{
  const src=fs.readFileSync('web/v30-student-add-rpc-fix.js','utf8');
  assert.match(src,/rpc\('v31_add_student_authorized'/);
  assert.doesNotMatch(src,/from\(['"]students['"]\)\.(insert|upsert)/);
  assert.match(src,/FSTStudentAddRpcFix/);
});
