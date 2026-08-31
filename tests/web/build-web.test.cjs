const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const cp=require('node:child_process');

test('builder produces the rebuilt self-contained online interface',()=>{
  cp.execFileSync('python',['scripts/build_online_web.py'],{stdio:'pipe'});
  cp.execFileSync('python',['scripts/build_single_file_release.py'],{stdio:'pipe'});
  const html=fs.readFileSync('web/index.html','utf8');
  assert.match(html,/data-testid="login-identifier"/);
  assert.match(html,/FSTApp\.auth\.restoreSession/);
  assert.match(html,/FSTApp\.boot/);
  assert.match(html,/teacher_directory/);
  assert.match(html,/save_attendance_sheet/);
  assert.doesNotMatch(html,/<script[^>]+src=/i);
  assert.doesNotMatch(fs.readFileSync('scripts/build_online_web.py','utf8'),/web-superadmin\.patch|git.*apply/);
});
