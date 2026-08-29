const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const cp=require('node:child_process');

test('builder produces approved interface with online runtime',()=>{
  cp.execFileSync('python',['scripts/build_online_web.py'],{stdio:'pipe'});
  const html=fs.readFileSync('web/index.html','utf8');
  assert.match(html,/teacher_directory/);
  assert.match(html,/restorePersistentSession/);
  assert.match(html,/\.\/online-runtime\.js/);
  assert.equal(fs.existsSync('web/online-runtime.js'),true);
});
