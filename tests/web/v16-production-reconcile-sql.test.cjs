const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path='supabase/ops/2026-09-04_v16_official_calendar_reconcile.sql';
const sql=fs.existsSync(path)?fs.readFileSync(path,'utf8'):'';

test('production reconciliation is an explicit guarded transaction',()=>{
  assert.match(sql,/^\s*begin;/i);
  assert.match(sql,/commit;\s*$/i);
  assert.match(sql,/2026\/2027/);
  assert.match(sql,/semester\s*=\s*1/i);
  assert.match(sql,/SESSION_ALREADY_STARTED/i);
  assert.match(sql,/assignments_finalized/i);
});

test('reconciliation restores holiday and DS dates without inventing rooms or teachers',()=>{
  for(const date of ['2026-10-15','2026-11-02','2026-11-05','2026-11-06'])assert.match(sql,new RegExp(date),date);
  assert.match(sql,/JOUR FERIE/i);
  assert.match(sql,/F[eê]te de l[’']Évacuation|Evacuation/i);
  assert.match(sql,/DS|REPOS/i);
  assert.doesNotMatch(sql,/random\(|gen_random_uuid\(\).*teacher|room\s*=\s*['"][ABCD]['"]/i);
});

test('reconciliation protects historical presence data and validates teacher weeks',()=>{
  assert.match(sql,/attendance|presence/i);
  assert.match(sql,/grade|note/i);
  assert.match(sql,/comment/i);
  assert.match(sql,/v16_verify_teacher_week/i);
});

test('calendar-only reconciliation records legacy room conflicts without blocking untouched rows',()=>{
  assert.match(sql,/legacy_room_conflict_sessions/i);
  assert.match(sql,/count\s*\(\s*distinct\s+a\.room\s*\)\s*<\s*4/i);
  assert.doesNotMatch(sql,/raise exception 'VALID_MANUAL_PLAN_REQUIRED: fix teacher\/room assignments/i);
});

test('reconciliation audits the official calendar change',()=>{
  assert.match(sql,/v16_official_calendar_reconciled/i);
  assert.match(sql,/private\.v515_audit/i);
});
