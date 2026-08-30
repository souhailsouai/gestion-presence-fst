const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const p='web/online-fixes.js';
test('strict online fixes exist',()=>{
  assert.equal(fs.existsSync(p),true);
  const js=fs.readFileSync(p,'utf8');
  assert.match(js,/window\.loadData=async/);
  assert.match(js,/presence_profile_cache/);
  assert.match(js,/window\.handleFile=function/);
  assert.match(js,/upsert\('classes'/);
  assert.match(js,/upsert\('students'/);
  assert.equal(js.includes('localStorage.setItem'),false);
});
