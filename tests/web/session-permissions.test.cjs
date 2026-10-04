const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const modulePath=path.join(__dirname,'../../web/session-permissions.js');
function load(){assert.equal(fs.existsSync(modulePath),true);delete require.cache[require.resolve(modulePath)];return require(modulePath);}

const teacher={id:'t1',isAdmin:false};
const admin={id:'a1',isAdmin:true};
const activeOwn={id:'s1',teacherId:'t1',completedAt:null};
const doneOwn={id:'s2',teacherId:'t1',completedAt:'2026-08-30T08:00:00Z'};
const foreignDone={id:'s3',teacherId:'t2',completedAt:'2026-08-30T08:00:00Z'};

test('teacher can edit attendance comment and grade before completion',()=>{
  const P=load();
  assert.equal(P.canEditAttendance(teacher,activeOwn),true);
  assert.equal(P.canEditComment(teacher,activeOwn),true);
  assert.equal(P.canEditGrade(teacher,activeOwn),true);
});

test('teacher keeps attendance comment and grade edit rights on own completed session',()=>{
  const P=load();
  assert.equal(P.canEditAttendance(teacher,doneOwn),true);
  assert.equal(P.canEditComment(teacher,doneOwn),true);
  assert.equal(P.canEditGrade(teacher,doneOwn),true);
});

test('admin can edit all fields on any completed session',()=>{
  const P=load();
  assert.equal(P.canEditAttendance(admin,foreignDone),true);
  assert.equal(P.canEditComment(admin,foreignDone),true);
  assert.equal(P.canEditGrade(admin,foreignDone),true);
});

test('foreign teacher cannot edit any field',()=>{
  const P=load();
  assert.equal(P.canEditAttendance(teacher,foreignDone),false);
  assert.equal(P.canEditComment(teacher,foreignDone),false);
  assert.equal(P.canEditGrade(teacher,foreignDone),false);
});
