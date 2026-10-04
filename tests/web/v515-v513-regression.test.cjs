const fs=require('node:fs');
const test=require('node:test');
const assert=require('node:assert/strict');
const permissions=require('../../web/session-permissions.js');

test('v5.13 stable reference metadata remains canonical',()=>{
  const ref=fs.readFileSync('releases/v5.13/REFERENCE.md','utf8');
  assert.match(ref,/Version: V5\.13/);
  assert.match(ref,/73daccbc12f1e9d0068a53a5d3f7052f3002a49963ce3842f3fa6040650538e8/);
  assert.match(ref,/Do not overwrite the V5\.13 reference/);
});

test('current teacher permissions allow attendance and grades on own sessions even after completion',()=>{
  const owner={id:'teacher-a',isAdmin:false};
  const admin={id:'admin',isAdmin:true};
  const open={teacherId:'teacher-a',completedAt:null};
  const closed={teacherId:'teacher-a',completedAt:'2026-09-14T17:30:00Z'};
  assert.equal(permissions.canEditAttendance(owner,open),true);
  assert.equal(permissions.canEditAttendance(owner,closed),true);
  assert.equal(permissions.canEditAttendance(admin,closed),true);
  assert.equal(permissions.canEditGrade(owner,open),true);
  assert.equal(permissions.canEditGrade(owner,closed),true);
  assert.equal(permissions.canEditGrade(admin,closed),true);
});

test('presence sheet has an explicit empty-group state',()=>{
  const src=fs.readFileSync('web/session-editing.js','utf8');
  assert.match(src,/Aucun étudiant n’est associé à ce groupe/);
});
