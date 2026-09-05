const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const path='supabase/migrations/20260905070100_v16_atomic_test_apply_session_plan_sync.sql';
const sql=fs.existsSync(path)?fs.readFileSync(path,'utf8'):'';

function fn(name){
  const escaped=name.replaceAll('.','\\.');
  return sql.match(new RegExp(`create or replace function ${escaped}\\([\\s\\S]*?\\n\\$\\$;`,'i'))?.[0]||'';
}

test('additive migration replaces the existing TEST to REAL apply RPC',()=>{
  assert.match(sql,/^begin\s*;/i);
  assert.match(sql,/commit\s*;\s*$/i);
  const body=fn('public.v16_apply_test_teacher_plan');
  assert.ok(body,'v16_apply_test_teacher_plan replacement is missing');
  assert.match(body,/REAL_CALENDAR_RECONCILIATION_REQUIRED/i);
  assert.match(body,/ROOM_REQUIRED/i);
  assert.match(body,/UNMAPPED_TEST_ASSIGNMENT/i);
  assert.match(body,/SESSION_ALREADY_STARTED/i);
  assert.match(body,/private\.v16_verify_test_apply_week/i);
});

test('apply resolves target class for every mapped TEST assignment before writes',()=>{
  const body=fn('public.v16_apply_test_teacher_plan');
  assert.match(body,/create\s+temporary\s+table\s+v16_apply_targets/i);
  assert.match(body,/c\.name\s*=\s*ts\.class_name\s*\|\|\s*'-G'\s*\|\|\s*ta\.group_no/i);
  assert.match(body,/TARGET_CLASS_MISSING/i);
  assert.match(body,/legacy_plan_id/i);
});

test('session plan synchronization is three-phase and finalizes all four structural fields',()=>{
  const body=fn('public.v16_apply_test_teacher_plan');
  const neutralize=body.search(/update\s+public\.session_plans\s+sp[\s\S]*?set\s+manipulation\s*=\s*null/i);
  const structural=body.search(/update\s+public\.session_plans\s+sp[\s\S]*?set\s+class_id\s*=\s*t\.target_class_id[\s\S]*?manipulation\s*=\s*t\.manipulation_code/i);
  const authority=body.search(/update\s+public\.session_plans\s+sp[\s\S]*?set\s+teacher_id\s*=\s*t\.teacher_id[\s\S]*?room\s*=\s*t\.room/i);
  assert.ok(neutralize>=0,'neutralization phase missing');
  assert.ok(structural>neutralize,'class/manipulation phase must follow neutralization');
  assert.ok(authority>structural,'teacher/room authority phase must be last');
  assert.match(body,/sp\.session_id\s+is\s+null/i);
  assert.match(body,/sp\.deleted_at\s+is\s+null/i);
});

test('apply remains transactional and never disables legacy triggers or constraints globally',()=>{
  const body=fn('public.v16_apply_test_teacher_plan');
  assert.doesNotMatch(body,/disable\s+trigger/i);
  assert.doesNotMatch(body,/alter\s+table[\s\S]+disable/i);
  assert.doesNotMatch(body,/drop\s+trigger/i);
  assert.match(body,/set\s+constraints\s+v16_real_room_conflict_guard\s+immediate/i);
  assert.match(body,/public\.v16_verify_teacher_week/i);
});

test('atomic apply migration does not touch attendance grades or comments',()=>{
  assert.doesNotMatch(sql,/update\s+public\.attendance/i);
  assert.doesNotMatch(sql,/insert\s+into\s+public\.attendance/i);
  assert.doesNotMatch(sql,/\bgrade\b/i);
  assert.doesNotMatch(sql,/\bcomment\b/i);
});
