const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const p='web/v515-runtime.js';

test('V5.15 runtime integrates authentication and realtime without offline persistence',()=>{
  assert.equal(fs.existsSync(p),true);
  const js=fs.readFileSync(p,'utf8');
  for(const marker of ['v515_requests','v515_assignments','v515_session_positions','v515_teacher_config','v515_teacher_manipulations']) assert.match(js,new RegExp(marker),marker);
  for(const marker of ['onAuthenticated','refresh','startRealtime','stopRealtime','onLogout','FSTV515TeacherUI','FSTV515AdminUI','postgres_changes','removeChannel']) assert.match(js,new RegExp(marker),marker);
  assert.match(js,/window\.doLogin/);
  assert.match(js,/window\.logoutTeacher/);
  assert.match(js,/window\.switchAccount/);
  assert.match(js,/window\.FSTV515=/);
  for(const forbidden of ['localStorage.setItem','sync_queue','saveCache','loadCache']) assert.equal(js.includes(forbidden),false,forbidden);
});
