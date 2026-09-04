const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = 'supabase/migrations/20260904170000_v16_manual_planning_rules.sql';
const sql = fs.existsSync(path) ? fs.readFileSync(path,'utf8') : '';

test('manual planning removes same-session manipulation uniqueness', () => {
  assert.match(sql, /drop constraint if exists v515_assignments_session_id_manipulation_code_key/i);
  assert.match(sql, /drop constraint if exists v16_test_assignments_test_session_id_manipulation_code_key/i);
});

test('room integrity uses deferred blocking triggers without pre-validating legacy rows', () => {
  assert.match(sql, /create constraint trigger v16_real_room_conflict_guard/i);
  assert.match(sql, /create constraint trigger v16_test_room_conflict_guard/i);
  assert.match(sql, /deferrable initially deferred/i);
  assert.match(sql, /pg_advisory_xact_lock/i);
  assert.match(sql, /ROOM_TIME_CONFLICT/i);
  assert.doesNotMatch(sql, /create unique index[^;]+\(session_id\s*,\s*room\)/i);
});

test('manual planning enforces manipulation history server-side', () => {
  assert.match(sql, /v16_enforce_real_group_manip_history/i);
  assert.match(sql, /v16_enforce_test_group_manip_history/i);
  assert.match(sql, /REPEATED_GROUP_MANIPULATION/i);
});

test('week validator supports 3-day, 2-day holiday, and 0-day DS weeks', () => {
  assert.match(sql, /TEACHING_DAY_COUNT_UNSUPPORTED/i);
  assert.match(sql, /HOLIDAY_WEEK_DISTRIBUTION/i);
  assert.match(sql, /TEACHER_WEEKDAY_COUNT/i);
  assert.match(sql, /MAX_TWO_DAYS_PER_TEACHER/i);
});

test('week save is Admin-only security invoker', () => {
  assert.match(sql, /create or replace function public\.v16_save_week_plan/i);
  assert.match(sql, /security invoker/i);
  assert.match(sql, /private\.is_admin\(\)/i);
  assert.match(sql, /revoke execute on function public\.v16_save_week_plan\(date,jsonb,text\) from public,anon/i);
});

test('room guard permits untouched legacy room rows until explicit V16 reconciliation', () => {
  assert.match(sql, /tg_op='UPDATE'[\s\S]+new\.room is not distinct from old\.room/i);
});

test('week type counts distinct teaching dates and REAL save synchronizes mapped presence plans', () => {
  assert.match(sql, /count\s*\(\s*distinct\s+s\.session_date\s*\)\s+into\s+v_teaching_days/i);
  assert.match(sql, /update public\.session_plans sp[\s\S]+teacher_id=a\.teacher_id[\s\S]+manipulation=a\.manipulation_code[\s\S]+room=a\.room/i);
});
