const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path='web/v16-active-role.js';
const source=fs.existsSync(path)?fs.readFileSync(path,'utf8'):'';
let api=null;
try{api=require('../../web/v16-active-role.js');}catch(_){api=null;}

test('V16 active role module exists and exposes explicit role API',()=>{
  assert.ok(source.length>0,'v16-active-role.js missing');
  assert.ok(api,'module cannot be loaded');
  for(const fn of ['get','set','canUseAdminControls','canUseTestMode'])assert.equal(typeof api[fn],'function',fn);
});

test('dual-role accounts can switch active role without name or email special cases',()=>{
  api.configure({isAdmin:true,initialRole:'teacher'});
  assert.equal(api.get(),'teacher');
  assert.equal(api.canUseAdminControls(),false);
  api.set('admin');
  assert.equal(api.get(),'admin');
  assert.equal(api.canUseAdminControls(),true);
  assert.equal(api.canUseTestMode(),true);
  assert.doesNotMatch(source,/Souhail|souai|@/i);
});

test('teacher-only accounts can never switch to admin or TEST',()=>{
  api.configure({isAdmin:false,initialRole:'teacher'});
  assert.equal(api.set('admin'),false);
  assert.equal(api.get(),'teacher');
  assert.equal(api.canUseAdminControls(),false);
  assert.equal(api.canUseTestMode(),false);
});

test('role changes emit v16:role-changed in browser mode and access-control consumes active role',()=>{
  assert.match(source,/v16:role-changed/);
  const access=fs.readFileSync('web/access-control.js','utf8');
  assert.match(access,/V16ActiveRole/);
  assert.match(access,/canUseAdminControls/);
});
