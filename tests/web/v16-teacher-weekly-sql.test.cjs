const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const policyPath='supabase/migrations/20260903170000_v16_teacher_weekly_policy.sql';
const swapPath='supabase/migrations/20260903170100_v16_teacher_permutations.sql';
const sql=fs.existsSync(policyPath)?fs.readFileSync(policyPath,'utf8'):'';
const swap=fs.existsSync(swapPath)?fs.readFileSync(swapPath,'utf8'):'';

test('V16 weekly teacher policy migration defines an Admin-only verifier',()=>{
  assert.ok(sql.length>0,'weekly policy migration missing');
  assert.match(sql,/create or replace function public\.v16_verify_teacher_week\s*\(/i);
  assert.match(sql,/p_week_start\s+date/i);
  assert.match(sql,/p_context\s+text\s+default\s+'real'/i);
  assert.match(sql,/security invoker/i);
  assert.match(sql,/set search_path\s*=\s*''/i);
  assert.match(sql,/auth\.uid\(\) is null/i);
  assert.match(sql,/private\.is_admin\(\)/i);
  assert.match(sql,/revoke execute on function public\.v16_verify_teacher_week/i);
  assert.match(sql,/grant execute on function public\.v16_verify_teacher_week/i);
});

test('weekly verifier enforces 4 teachers per teaching day and six teachers on two days each',()=>{
  assert.match(sql,/DAY_TEACHER_COUNT/i);
  assert.match(sql,/count\s*\(\s*distinct\s+a\.teacher_id\s*\)/i);
  assert.match(sql,/<>\s*4/i);
  assert.match(sql,/WEEK_TEACHER_COUNT/i);
  assert.match(sql,/count\s*\(\s*distinct\s+teacher_id\s*\)/i);
  assert.match(sql,/<>\s*6/i);
  assert.match(sql,/TEACHER_WEEKDAY_COUNT/i);
  assert.match(sql,/count\s*\(\s*distinct\s+session_date\s*\)/i);
  assert.match(sql,/<>\s*2/i);
});

test('weekly verifier rejects same-day duplicates and time conflicts',()=>{
  assert.match(sql,/TEACHER_DUPLICATE_DAY/i);
  assert.match(sql,/having\s+count\s*\(\*\)\s*>\s*1/i);
  assert.match(sql,/TEACHER_TIME_CONFLICT/i);
  assert.match(sql,/s1\.start_time\s*<\s*s2\.end_time/i);
  assert.match(sql,/s1\.end_time\s*>\s*s2\.start_time/i);
});

test('weekly policy uses Africa Tunis locking and audits verification',()=>{
  assert.match(sql,/timezone\s*\(\s*'Africa\/Tunis'\s*,\s*now\(\)\s*\)/i);
  assert.match(sql,/SESSION_ALREADY_STARTED/i);
  assert.match(sql,/private\.v515_audit/i);
  assert.match(sql,/v16_teacher_week_verified/i);
  assert.match(sql,/jsonb_build_object\s*\(\s*'ok'/i);
});

test('V16 permutation migration exposes an Admin-only weekly/future swap RPC',()=>{
  assert.ok(swap.length>0,'teacher permutation migration missing');
  assert.match(swap,/create or replace function public\.v16_swap_teachers\s*\(/i);
  for(const marker of ['p_teacher_a uuid','p_day_a integer','p_teacher_b uuid','p_day_b integer','p_effective_date date','p_scope text','p_context text default \'real\'']){
    assert.match(swap,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'),marker);
  }
  assert.match(swap,/p_scope\s+not in\s*\(\s*'week'\s*,\s*'future'\s*\)/i);
  assert.match(swap,/security invoker/i);
  assert.match(swap,/set search_path\s*=\s*''/i);
  assert.match(swap,/private\.is_admin\(\)/i);
});

test('teacher swap protects started sessions and limits week/future scope',()=>{
  assert.match(swap,/timezone\s*\(\s*'Africa\/Tunis'\s*,\s*now\(\)\s*\)/i);
  assert.match(swap,/SESSION_ALREADY_STARTED/i);
  assert.match(swap,/p_effective_date/i);
  assert.match(swap,/p_scope\s*=\s*'week'/i);
  assert.match(swap,/p_scope\s*=\s*'future'/i);
  assert.match(swap,/session_date\s*>=\s*p_effective_date/i);
});

test('teacher swap validates candidate weekly totals before persisting',()=>{
  assert.match(swap,/create temporary table/i);
  assert.match(swap,/on commit drop/i);
  assert.match(swap,/DAY_TEACHER_COUNT/i);
  assert.match(swap,/WEEK_TEACHER_COUNT/i);
  assert.match(swap,/TEACHER_WEEKDAY_COUNT/i);
  assert.match(swap,/TEACHER_DUPLICATE_DAY/i);
  assert.match(swap,/TEACHER_TIME_CONFLICT/i);
  assert.match(swap,/if jsonb_array_length\(v_blockers\)>0 then/i);
  const firstUpdate=swap.search(/update\s+public\.v515_assignments/i);
  const blockerGate=swap.search(/if jsonb_array_length\(v_blockers\)>0 then/i);
  assert.ok(firstUpdate>blockerGate,'real assignment update must occur only after candidate validation');
});

test('teacher swap updates linked legacy plans and writes audit event',()=>{
  assert.match(swap,/update\s+public\.session_plans/i);
  assert.match(swap,/legacy_plan_id/i);
  assert.match(swap,/private\.v515_audit/i);
  assert.match(swap,/v16_teacher_swap_applied/i);
  assert.match(swap,/revoke execute on function public\.v16_swap_teachers/i);
  assert.match(swap,/grant execute on function public\.v16_swap_teachers/i);
});
