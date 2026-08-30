const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const cp=require('node:child_process');

test('builder produces approved self-contained online interface',()=>{
  cp.execFileSync('python',['scripts/build_online_web.py'],{stdio:'pipe'});
  cp.execFileSync('python',['scripts/build_single_file_release.py'],{stdio:'pipe'});
  const html=fs.readFileSync('web/index.html','utf8');
  assert.match(html,/teacher_directory/);
  assert.match(html,/restorePersistentSession/);
  assert.match(html,/window\.FSTOnlineRuntime=/);
  assert.match(html,/window\.loadData=async function/);
  assert.doesNotMatch(html,/\.\/online-runtime\.js/);
});
