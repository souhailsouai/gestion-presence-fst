const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const policyPath='supabase/migrations/20260903170000_v16_teacher_weekly_policy.sql';
const sql=fs.existsSync(policyPath)?fs.readFileSync(policyPath,'utf8'):'';

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
