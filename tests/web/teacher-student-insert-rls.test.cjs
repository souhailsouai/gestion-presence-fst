const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');

function latestStudentInsertPolicy(){
  const dir=path.join(__dirname,'../../supabase/migrations');
  const sql=fs.readdirSync(dir).filter(n=>n.endsWith('.sql')).sort()
    .map(n=>fs.readFileSync(path.join(dir,n),'utf8')).join('\n');
  const marker='create policy students_insert_authorized on public.students';
  const pos=sql.lastIndexOf(marker);
  assert.notEqual(pos,-1,'students_insert_authorized policy missing');
  const next=sql.indexOf('\ndrop policy ',pos+marker.length);
  return sql.slice(pos,next===-1?sql.length:next);
}

test('teacher insert policy authorizes assigned MPI1-PC1 groups independently of legacy student owner',()=>{
  const policy=latestStudentInsertPolicy();
  assert.match(policy,/session_plans[\s\S]*sp\.teacher_id=\(select auth\.uid\(\)\)/);
  assert.match(policy,/sessions[\s\S]*se\.teacher_id=\(select auth\.uid\(\)\)/);
  assert.doesNotMatch(policy,/students\.teacher_id=\(select auth\.uid\(\)\)/);
});

test('teacher student creation always stamps the authenticated teacher id',()=>{
  const src=fs.readFileSync(path.join(__dirname,'../../web/access-control.js'),'utf8');
  const block=src.slice(src.indexOf('window.addStudent=async function'),src.indexOf('window.FSTAccessControl='));
  assert.match(block,/teacher_id:currentTeacher\.id/);
  assert.doesNotMatch(block,/teacher_id:c\.teacherId\|\|currentTeacher\.id/);
});
