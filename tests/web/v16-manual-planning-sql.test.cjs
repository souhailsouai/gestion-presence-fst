const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const realPath = 'supabase/migrations/20260904170000_v16_manual_planning_rules.sql';
const testPath = 'supabase/migrations/20260904170100_v16_test_manual_planning.sql';
const deferredPath = 'supabase/migrations/20260904170200_v16_deferred_manip_history.sql';
const safetyPath = 'supabase/migrations/20260904170300_v16_test_calendar_safety.sql';
const concurrencyPath = 'supabase/migrations/20260904170400_v16_manip_history_concurrency.sql';
const sql = fs.existsSync(realPath) ? fs.readFileSync(realPath,'utf8') : '';
const testSql = fs.existsSync(testPath) ? fs.readFileSync(testPath,'utf8') : '';
const deferredSql = fs.existsSync(deferredPath) ? fs.readFileSync(deferredPath,'utf8') : '';
const safetySql = fs.existsSync(safetyPath) ? fs.readFileSync(safetyPath,'utf8') : '';
const concurrencySql = fs.existsSync(concurrencyPath) ? fs.readFileSync(concurrencyPath,'utf8') : '';
const effectiveTestSql = testSql + '\n' + deferredSql + '\n' + safetySql + '\n' + concurrencySql;

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

test('effective manipulation history uses transaction locks so concurrent saves cannot create duplicates',()=>{
  assert.match(concurrencySql,/create or replace function private\.v16_enforce_real_group_manip_history/i);
  assert.match(concurrencySql,/pg_advisory_xact_lock\([\s\S]+v16-real-manip/i);
  assert.match(concurrencySql,/create or replace function private\.v16_enforce_test_group_manip_history/i);
  assert.match(concurrencySql,/pg_advisory_xact_lock\([\s\S]+v16-test-manip/i);
});

test('manipulation history is deferred so atomic multi-row week updates are order-independent',()=>{
  assert.match(deferredSql,/drop trigger if exists v16_real_group_manip_history_guard/i);
  assert.match(deferredSql,/drop trigger if exists v16_test_group_manip_history_guard/i);
  assert.match(deferredSql,/create constraint trigger v16_real_group_manip_history_guard/i);
  assert.match(deferredSql,/create constraint trigger v16_test_group_manip_history_guard/i);
  assert.match(deferredSql,/deferrable initially deferred/i);
  assert.match(deferredSql,/after insert or update/i);
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

test('TEST migrations clone REAL structural planning only', () => {
  assert.match(effectiveTestSql, /create or replace function public\.v16_clone_real_to_test\s*\(/i);
  assert.match(effectiveTestSql, /real_session_id/i);
  assert.match(effectiveTestSql, /real_assignment_id/i);
  assert.match(effectiveTestSql, /teacher_id/i);
  assert.match(effectiveTestSql, /manipulation_code/i);
  assert.match(effectiveTestSql, /room/i);
  assert.doesNotMatch(effectiveTestSql, /insert into public\.v16_test_attendance/i);
});

test('effective TEST clone excludes the holiday and seeds manipulations from official class occurrence patterns',()=>{
  assert.match(deferredSql,/session_date\s*<>\s*'2026-10-15'/i);
  assert.match(deferredSql,/class_occurrence/i);
  assert.match(deferredSql,/when\s+1\s+then[\s\S]*M1[\s\S]*M2[\s\S]*M3[\s\S]*M4/i);
  assert.match(deferredSql,/when\s+5\s+then[\s\S]*M5[\s\S]*M6/i);
  assert.match(deferredSql,/when\s+6\s+then[\s\S]*M6[\s\S]*M5/i);
  assert.match(deferredSql,/REAL_CALENDAR_NOT_RECONCILED/i);
});

test('TEST week save and TEST to REAL apply all structural fields', () => {
  assert.match(testSql, /create or replace function public\.v16_save_test_week_plan\s*\(/i);
  assert.match(testSql, /create or replace function public\.v16_apply_test_teacher_plan\s*\(/i);
  assert.match(testSql, /set\s+teacher_id\s*=\s*ta\.teacher_id[\s\S]+manipulation_code\s*=\s*ta\.manipulation_code[\s\S]+room\s*=\s*ta\.room/i);
  assert.match(testSql, /SESSION_ALREADY_STARTED/i);
  assert.match(testSql, /HOLIDAY_WEEK_DISTRIBUTION/i);
  assert.match(testSql, /MAX_TWO_DAYS_PER_TEACHER/i);
});

test('TEST planning RPCs are Admin-only security invoker', () => {
  assert.match(effectiveTestSql, /security invoker/i);
  assert.match(effectiveTestSql, /private\.is_admin\(\)/i);
  assert.match(effectiveTestSql, /revoke execute on function public\.v16_clone_real_to_test\(date\) from public,anon/i);
  assert.match(testSql, /revoke execute on function public\.v16_save_test_week_plan\(date,jsonb\) from public,anon/i);
});
