const fs=require('node:fs');
const test=require('node:test');
const assert=require('node:assert/strict');

const src=fs.readFileSync('web/v30-lpc3.js','utf8');

test('LPC3 management remains private to Souhail Souai admin profile',()=>{
  assert.match(src,/const OWNER_ID='e9a874d5-4e7e-48f2-a8bd-d59003599570'/);
  assert.match(src,/function isOwner\(\)[\s\S]*OWNER_ID[\s\S]*role==='admin'/);
  assert.match(src,/u\?\.isAdmin===true/);
  assert.match(src,/if\(!isOwner\(\)\)return root\.showAlert/);
});

test('LPC3 section can add a student into G1-G4 through authorized RPC',()=>{
  assert.match(src,/id="lpc3-add-student"/);
  assert.match(src,/id="lpc3-add-group"/);
  assert.match(src,/rpc\('v31_add_student_authorized'/);
  assert.match(src,/p_class_id:target\.id/);
});

test('LPC3 section can move a student while preserving assignment history',()=>{
  assert.match(src,/id="lpc3-move-student"/);
  assert.match(src,/id="lpc3-move-group"/);
  assert.match(src,/id="lpc3-move-date"/);
  assert.match(src,/rpc\('v30_teacher_assign_student'/);
  assert.match(src,/p_effective_from:effectiveFrom/);
});
