const test=require('node:test');
const assert=require('node:assert/strict');
const D=require('../../web/v31-domain.js');

test('retard remains distinct but counts in global presence rate',()=>{
  const r=D.summarizeAttendance([
    {status:'present',applicable:true,environment:'MPI1_PC1'},
    {status:'retard',applicable:true,environment:'MPI1_PC1'},
    {status:'absent',applicable:true,environment:'MPI1_PC1'},
    {status:'justifie',applicable:true,environment:'MPI1_PC1'}
  ],{environment:'MPI1_PC1'});
  assert.equal(r.present,1);
  assert.equal(r.late,1);
  assert.equal(r.unjustifiedAbsences,1);
  assert.equal(r.justifiedAbsences,1);
  assert.equal(r.totalAbsences,2);
  assert.equal(r.countedSessions,4);
  assert.equal(r.presencePercent,50);
  assert.equal(r.absencePercent,50);
});

test('zero sessions produces finite neutral percentages',()=>{
  const r=D.summarizeAttendance([],{environment:'MPI1_PC1'});
  assert.equal(r.presencePercent,0);
  assert.equal(r.absencePercent,0);
  assert.equal(Number.isFinite(r.presencePercent),true);
  assert.equal(Number.isFinite(r.absencePercent),true);
});

test('LPC3 rows are excluded from MPI1-PC1 statistics',()=>{
  const r=D.summarizeAttendance([
    {status:'present',applicable:true,environment:'MPI1_PC1'},
    {status:'absent',applicable:true,environment:'LPC3'}
  ],{environment:'MPI1_PC1'});
  assert.equal(r.countedSessions,1);
  assert.equal(r.present,1);
  assert.equal(r.absent,0);
});

test('unjustified absence forces automatic zero',()=>{
  const r=D.applyAttendanceGradeRule({status:'absent',grade:null});
  assert.equal(r.grade,0);
  assert.equal(r.gradeOrigin,'absence_auto');
  assert.equal(r.locked,true);
});

test('justified absence never creates automatic zero',()=>{
  const r=D.applyAttendanceGradeRule({status:'justifie',grade:0,gradeOrigin:'absence_auto'});
  assert.equal(r.grade,null);
  assert.equal(r.gradeOrigin,null);
  assert.equal(r.locked,true);
});

test('automatic zero is removed when absence is corrected to present',()=>{
  const r=D.applyAttendanceGradeRule({status:'present',grade:0,gradeOrigin:'absence_auto'});
  assert.equal(r.grade,null);
  assert.equal(r.gradeOrigin,null);
  assert.equal(r.locked,false);
});

test('automatic zero is removed when absence is corrected to retard',()=>{
  const r=D.applyAttendanceGradeRule({status:'retard',grade:0,gradeOrigin:'absence_auto'});
  assert.equal(r.grade,null);
  assert.equal(r.gradeOrigin,null);
});

test('manual zero is never treated as an automatic absence zero',()=>{
  const r=D.applyAttendanceGradeRule({status:'present',grade:0,gradeOrigin:'manual'});
  assert.equal(r.grade,0);
  assert.equal(r.gradeOrigin,'manual');
});

test('manual grade is backed up while unjustified absence forces zero and restored later',()=>{
  const absent=D.applyAttendanceGradeRule({status:'absent',grade:0,gradeOrigin:'manual'});
  assert.equal(absent.grade,0);
  assert.equal(absent.gradeOrigin,'absence_auto');
  assert.equal(absent.manualGradeBackup,0);
  const present=D.applyAttendanceGradeRule({
    status:'present',
    grade:absent.grade,
    gradeOrigin:absent.gradeOrigin,
    manualGradeBackup:absent.manualGradeBackup
  });
  assert.equal(present.grade,0);
  assert.equal(present.gradeOrigin,'manual');
});
