const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');

const migration=fs.readFileSync(path.join(__dirname,'../../supabase/migrations/20261005070500_add_student_rpc_preserve_pr23_visibility.sql'),'utf8');
const runtime=fs.readFileSync(path.join(__dirname,'../../web/online-runtime.js'),'utf8');
const access=fs.readFileSync(path.join(__dirname,'../../web/access-control.js'),'utf8');

test('student creation uses RPC while PR23 SELECT policy stays independent',()=>{
  assert.match(migration,/create or replace function public\.v31_add_student_authorized/i);
  assert.match(migration,/security definer/i);
  assert.match(migration,/private\.mutation_allowed\(\)/i);
  assert.match(migration,/session_plans[\s\S]*teacher_id\s*=\s*v_uid/i);
  assert.match(migration,/sessions[\s\S]*teacher_id\s*=\s*v_uid/i);
  assert.match(migration,/TP Ondes et Vibrations[\s\S]*private\.is_lpc3_owner\(\)/i);
  assert.match(migration,/insert into public\.students/i);
  assert.match(runtime,/rpc\(['"]v31_add_student_authorized['"]/);
  assert.match(access,/rpc\(['"]v31_add_student_authorized['"]/);
  assert.doesNotMatch(access,/from\(['"]students['"]\)\.insert/);
});
