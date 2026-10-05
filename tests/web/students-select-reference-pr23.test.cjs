const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');

const migration=path.join(__dirname,'../../supabase/migrations/20261005065613_restore_students_select_reference_pr23.sql');

test('student SELECT visibility matches the PR23 reference policy',()=>{
  assert.equal(fs.existsSync(migration),true,'missing PR23 student visibility migration');
  const sql=fs.readFileSync(migration,'utf8');
  assert.match(sql,/drop policy if exists students_select_authorized on public\.students/i);
  assert.match(sql,/create policy students_select_authorized on public\.students/i);
  assert.match(sql,/for select to authenticated/i);
  assert.match(sql,/using\s*\(\s*private\.can_access_student\s*\(\s*id\s*\)\s*\)/i);
});
