const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const path='supabase/migrations/20260904170600_v16_effective_week_preflight.sql';
const sql=fs.existsSync(path)?fs.readFileSync(path,'utf8'):'';

function fn(name){
  const escaped=name.replaceAll('.','\\.');
  return sql.match(new RegExp(`create or replace function ${escaped}\\([\\s\\S]*?\\n\\$\\$;`,'i'))?.[0]||'';
}

test('prospective week validator merges REAL before effective date and TEST from effective date',()=>{
  const body=fn('private.v16_verify_test_apply_week');
  assert.ok(body,'private.v16_verify_test_apply_week is missing');
  assert.match(body,/p_week_start\s+date/i);
  assert.match(body,/p_effective_date\s+date/i);
  assert.match(body,/rs\.session_date\s*<\s*p_effective_date[\s\S]+ra\.teacher_id/i);
  assert.match(body,/rs\.session_date\s*>=\s*p_effective_date[\s\S]+ta\.teacher_id/i);
  assert.match(body,/rs\.session_date\s*<\s*p_effective_date[\s\S]+ra\.room/i);
  assert.match(body,/rs\.session_date\s*>=\s*p_effective_date[\s\S]+ta\.room/i);
});

test('prospective week validator enforces the complete weekly teacher and room contract',()=>{
  const body=fn('private.v16_verify_test_apply_week');
  for(const marker of [
    'DAY_TEACHER_COUNT',
    'TEACHER_DUPLICATE_DAY',
    'MAX_TWO_DAYS_PER_TEACHER',
    'WEEK_TEACHER_COUNT',
    'TEACHER_WEEKDAY_COUNT',
    'HOLIDAY_WEEK_DISTRIBUTION',
    'ROOM_REQUIRED',
    'ROOM_TIME_CONFLICT',
    'TEACHER_NOT_CONFIGURED',
    'TEACHING_DAY_COUNT_UNSUPPORTED'
  ])assert.match(body,new RegExp(marker,'i'),marker);
  assert.match(body,/v515_teacher_constraints/i);
});

test('server preview validates affected weeks with prospective effective-date state',()=>{
  const body=fn('public.v16_preview_test_apply');
  assert.ok(body,'v16_preview_test_apply replacement is missing');
  assert.match(body,/private\.v16_verify_test_apply_week\s*\(\s*v_week\.week_start\s*,\s*p_effective_date\s*\)/i);
  assert.match(body,/TEST_WEEK_VALIDATION_FAILED/i);
});

test('TEST to REAL apply runs the same prospective validator before the first REAL update',()=>{
  const body=fn('public.v16_apply_test_teacher_plan');
  assert.ok(body,'v16_apply_test_teacher_plan replacement is missing');
  const validatePos=body.search(/private\.v16_verify_test_apply_week\s*\(\s*v_week\.week_start\s*,\s*p_effective_date\s*\)/i);
  const updatePos=body.search(/update\s+public\.v515_assignments/i);
  assert.ok(validatePos>=0,'prospective validator call missing');
  assert.ok(updatePos>=0,'REAL update missing');
  assert.ok(validatePos<updatePos,'prospective validator must run before REAL update');
  for(const marker of ['REAL_CALENDAR_RECONCILIATION_REQUIRED','ROOM_REQUIRED','UNMAPPED_TEST_ASSIGNMENT','SESSION_ALREADY_STARTED'])assert.match(body,new RegExp(marker,'i'),marker);
  assert.match(body,/public\.v16_verify_teacher_week\s*\(\s*v_week\.week_start\s*,\s*'real'\s*\)/i);
});

test('effective-week migration remains additive and does not touch attendance or grades',()=>{
  assert.match(sql,/^begin\s*;/i);
  assert.match(sql,/commit\s*;\s*$/i);
  assert.doesNotMatch(sql,/update\s+public\.attendance/i);
  assert.doesNotMatch(sql,/v16_test_attendance/i);
  assert.doesNotMatch(sql,/\bgrade\b/i);
});
