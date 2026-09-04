const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path='supabase/ops/2026-09-04_v16_official_calendar_reconcile.sql';
const sql=fs.existsSync(path)?fs.readFileSync(path,'utf8'):'';

test('reconciliation is an explicit guarded transaction for the finalized 2026/2027 cycle',()=>{
  assert.match(sql,/\bbegin\s*;/i);
  assert.match(sql,/\bcommit\s*;/i);
  assert.match(sql,/academic_year\s*=\s*'2026\/2027'/i);
  assert.match(sql,/semester\s*=\s*1/i);
  assert.match(sql,/assignments_finalized/i);
  assert.match(sql,/SESSION_ALREADY_STARTED/i);
  assert.match(sql,/session_id\s+is\s+not\s+null/i);
});

test('cycle identity lookup is UUID-safe and reads the unique row only after counting it',()=>{
  assert.doesNotMatch(sql,/min\s*\(\s*id\s*\)/i);
  assert.match(sql,/select\s+count\(\*\)[\s\S]+into\s+v_cycle_count[\s\S]+from\s+public\.v515_cycles/i);
  assert.match(sql,/if\s+v_cycle_count\s*<>\s*1[\s\S]+CYCLE_IDENTITY_INVALID/i);
  assert.match(sql,/select\s+id\s*,\s*status\s+into\s+v_cycle_id\s*,\s*v_cycle_status[\s\S]+from\s+public\.v515_cycles/i);
});

test('calendar reconciliation converts 15 October to holiday and shifts Thursday identity without advancing the holiday',()=>{
  assert.match(sql,/2026-10-15/);
  assert.match(sql,/is_teaching_session\s*=\s*false/i);
  assert.match(sql,/JOUR F[ÉE]RI[ÉE]/i);
  assert.match(sql,/2026-10-22[\s\S]+MPI1-C[\s\S]+class_occurrence[\s\S]+3/i);
  assert.match(sql,/2026-10-29[\s\S]+MPI1-D[\s\S]+class_occurrence[\s\S]+3/i);
  assert.match(sql,/2026-11-12[\s\S]+MPI1-C[\s\S]+class_occurrence[\s\S]+4/i);
  assert.match(sql,/2026-12-03[\s\S]+MPI1-D[\s\S]+class_occurrence[\s\S]+5/i);
});

test('DS dates stay non teaching and 15 October future structural rows are removed only when safe',()=>{
  for(const date of ['2026-11-02','2026-11-05','2026-11-06'])assert.match(sql,new RegExp(date.replaceAll('-','-')));
  assert.match(sql,/delete\s+from\s+public\.v515_assignments[\s\S]+2026-10-15/i);
  assert.match(sql,/deleted_at\s*=\s*now\(\)/i);
});

test('reconciliation clears only orphaned soft-deleted class/date conflicts before active plan remap',()=>{
  assert.match(sql,/SOFT_DELETED_PLAN_CONFLICT_HAS_REFERENCES/i);
  assert.match(sql,/create\s+temporary\s+table\s+v16_plan_remap_targets/i);
  assert.match(sql,/stale\.deleted_at\s+is\s+not\s+null/i);
  assert.match(sql,/stale\.session_id\s+is\s+not\s+null[\s\S]+SOFT_DELETED_PLAN_CONFLICT_HAS_REFERENCES/i);
  assert.match(sql,/public\.v515_assignments[\s\S]+legacy_plan_id\s*=\s*stale\.id[\s\S]+SOFT_DELETED_PLAN_CONFLICT_HAS_REFERENCES/i);
  assert.match(sql,/delete\s+from\s+public\.session_plans\s+stale[\s\S]+stale\.deleted_at\s+is\s+not\s+null[\s\S]+stale\.session_id\s+is\s+null[\s\S]+not\s+exists\s*\([\s\S]+legacy_plan_id\s*=\s*stale\.id/i);
  const cleanup=sql.search(/delete\s+from\s+public\.session_plans\s+stale/i);
  const remap=sql.search(/set\s+class_id\s*=\s*t\.target_class_id/i);
  assert.ok(cleanup>=0 && remap>cleanup,'orphan conflict cleanup must run before active remap');
});

test('reconciliation remaps unstarted presence plans to corrected class groups and preserves structural choices',()=>{
  assert.match(sql,/update\s+public\.session_plans\s+sp[\s\S]+set\s+class_id\s*=/i);
  assert.match(sql,/c\.name\s*=\s*s\.class_name\s*\|\|\s*'-G'\s*\|\|\s*a\.group_no/i);
  assert.doesNotMatch(sql,/set\s+teacher_id\s*=/i);
  assert.doesNotMatch(sql,/set\s+manipulation_code\s*=/i);
  assert.doesNotMatch(sql,/set\s+room\s*=/i);
});

test('reconciliation validates teacher-week distributions directly and defers TEST structural apply',()=>{
  assert.match(sql,/HOLIDAY_WEEK_DISTRIBUTION/i);
  assert.match(sql,/MAX_TWO_DAYS_PER_TEACHER/i);
  assert.match(sql,/TEACHER_WEEKDAY_COUNT/i);
  assert.match(sql,/v16_apply_test_teacher_plan/i);
  assert.match(sql,/v16_official_calendar_reconciled/i);
  assert.doesNotMatch(sql,/public\.v16_verify_teacher_week\(/i);
});
