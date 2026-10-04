const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');

const migration=path.join(__dirname,'../../supabase/migrations/20261004201500_fix_students_select_returning.sql');

test('students SELECT policy supports INSERT RETURNING without self-querying students',()=>{
  assert.equal(fs.existsSync(migration),true,'missing migration for students SELECT RETURNING');
  const sql=fs.readFileSync(migration,'utf8');
  assert.match(sql,/drop policy if exists students_select_authorized/i);
  assert.match(sql,/create policy students_select_authorized on public\.students/i);
  assert.match(sql,/session_plans[\s\S]*teacher_id\s*=\s*\(select auth\.uid\(\)\)/i);
  assert.match(sql,/sessions[\s\S]*teacher_id\s*=\s*\(select auth\.uid\(\)\)/i);
  assert.match(sql,/TP Ondes et Vibrations[\s\S]*private\.is_lpc3_owner\(\)/i);
  assert.doesNotMatch(sql,/private\.can_access_student\s*\(\s*id\s*\)/i);
});
