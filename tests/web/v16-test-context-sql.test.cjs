const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path='supabase/migrations/20260903170400_v16_test_context.sql';
const applyPath='supabase/migrations/20260903170500_v16_apply_test_to_real.sql';
const sql=fs.existsSync(path)?fs.readFileSync(path,'utf8'):'';
const apply=fs.existsSync(applyPath)?fs.readFileSync(applyPath,'utf8'):'';

test('V16 TEST context migration exists with explicit context storage',()=>{
  assert.ok(sql.length>0,'test context migration missing');
  assert.match(sql,/create table public\.v16_test_sessions/i);
  assert.match(sql,/create table public\.v16_test_assignments/i);
  assert.match(sql,/create table public\.v16_test_attendance/i);
  assert.match(sql,/create table public\.v16_test_scenarios/i);
  assert.match(sql,/check\s*\(\s*context\s*=\s*'test'\s*\)/i);
});

test('TEST tables are Admin-only through RLS and never teacher-owned',()=>{
  assert.match(sql,/enable row level security/i);
  for(const name of ['v16_test_sessions','v16_test_assignments','v16_test_attendance','v16_test_scenarios']){
    assert.match(sql,new RegExp(`create policy ${name}_admin[\\s\\S]+private\\.is_admin\\(\\)`,'i'),name);
  }
  assert.doesNotMatch(sql,/teacher_id\s*=\s*\(select auth\.uid\(\)\)/i);
});

test('reset RPC deletes TEST-only operational data and audits the reset',()=>{
  assert.match(sql,/create or replace function public\.v16_reset_test_context\s*\(/i);
  assert.match(sql,/security invoker/i);
  assert.match(sql,/set search_path\s*=\s*''/i);
  assert.match(sql,/private\.is_admin\(\)/i);
  for(const table of ['v16_test_attendance','v16_test_assignments','v16_test_sessions','v16_test_scenarios'])assert.match(sql,new RegExp(`delete from public\\.${table}`,'i'));
  assert.match(sql,/v16_test_context_reset/i);
  assert.match(sql,/private\.v515_audit/i);
  assert.doesNotMatch(sql,/delete from public\.(?:attendance|sessions|v515_assignments|v515_sessions)\b/i);
});

test('teachers cannot execute reset directly',()=>{
  assert.match(sql,/revoke execute on function public\.v16_reset_test_context\(\) from public,anon/i);
  assert.match(sql,/grant execute on function public\.v16_reset_test_context\(\) to authenticated/i);
  assert.match(sql,/FORBIDDEN/i);
});

test('TEST to REAL apply RPC is Admin-only and transfers teacher assignments only',()=>{
  assert.ok(apply.length>0,'apply migration missing');
  assert.match(apply,/create or replace function public\.v16_apply_test_teacher_plan\s*\(/i);
  assert.match(apply,/p_effective_date\s+date/i);
  assert.match(apply,/security invoker/i);
  assert.match(apply,/set search_path\s*=\s*''/i);
  assert.match(apply,/private\.is_admin\(\)/i);
  assert.match(apply,/v16_test_assignments/i);
  assert.match(apply,/update\s+public\.v515_assignments[\s\S]+teacher_id/i);
  assert.doesNotMatch(apply,/update\s+public\.attendance/i);
  assert.doesNotMatch(apply,/update\s+public\.students/i);
  assert.doesNotMatch(apply,/update\s+public\.v16_student_group_memberships/i);
});

test('apply protects started or completed real sessions and revalidates weekly policy',()=>{
  assert.match(apply,/timezone\s*\(\s*'Africa\/Tunis'\s*,\s*now\(\)\s*\)/i);
  assert.match(apply,/completed/i);
  assert.match(apply,/SESSION_ALREADY_STARTED|STARTED_SESSION/i);
  assert.match(apply,/v16_verify_teacher_week/i);
  assert.match(apply,/blockers/i);
  assert.match(apply,/warnings/i);
});

test('apply audits affected sessions and returns detailed result',()=>{
  assert.match(apply,/v16_test_teacher_plan_applied/i);
  assert.match(apply,/private\.v515_audit/i);
  for(const key of ['affected_sessions','effective_date','blockers','warnings'])assert.match(apply,new RegExp(`'${key}'`,'i'),key);
  assert.match(apply,/revoke execute on function public\.v16_apply_test_teacher_plan/i);
  assert.match(apply,/grant execute on function public\.v16_apply_test_teacher_plan/i);
});
