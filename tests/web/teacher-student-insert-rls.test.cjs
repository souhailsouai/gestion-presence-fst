const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');

const migrationPath=path.join(__dirname,'../../supabase/migrations/20261004191849_fix_teacher_student_insert_permission.sql');

test('teacher insert policy authorizes assigned MPI1-PC1 groups independently of legacy student owner',()=>{
  assert.equal(fs.existsSync(migrationPath),true,'teacher insert permission migration missing');
  const policy=fs.readFileSync(migrationPath,'utf8');
  assert.match(policy,/session_plans[\s\S]*sp\.teacher_id\s*=\s*\(select auth\.uid\(\)\)/);
  assert.match(policy,/sessions[\s\S]*se\.teacher_id\s*=\s*\(select auth\.uid\(\)\)/);
  assert.doesNotMatch(policy,/students\.teacher_id\s*=\s*\(select auth\.uid\(\)\)/);
  assert.match(policy,/TP Ondes et Vibrations[\s\S]*private\.is_lpc3_owner/);
});

test('teacher student creation always stamps the authenticated teacher id',()=>{
  const src=fs.readFileSync(path.join(__dirname,'../../web/access-control.js'),'utf8');
  const start=src.indexOf('window.addStudent=async function');
  const end=src.indexOf('window.FSTAccessControl=',start);
  const block=src.slice(start,end);
  assert.match(block,/teacher_id:currentTeacher\.id/);
  assert.doesNotMatch(block,/teacher_id:c\.teacherId\|\|currentTeacher\.id/);
});
