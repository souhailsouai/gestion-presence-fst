const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path='supabase/migrations/20260904170200_v16_test_calendar_safety.sql';
const sql=fs.existsSync(path)?fs.readFileSync(path,'utf8'):'';

test('TEST clone projects the approved Thursday calendar and unresolved duplicate rooms',()=>{
  assert.match(sql,/alter table public\.v16_test_assignments alter column room drop not null/i);
  assert.match(sql,/2026-10-15[\s\S]+then null/i);
  assert.match(sql,/2026-10-22[\s\S]+MPI1-C/i);
  assert.match(sql,/2026-10-29[\s\S]+MPI1-D/i);
  assert.match(sql,/2026-12-03[\s\S]+MPI1-D/i);
  assert.match(sql,/null::text\s+as\s+room/i);
  assert.match(sql,/ts\.class_name is not null/i);
});

test('TEST teacher choice is server-side limited to the six configured teachers',()=>{
  assert.match(sql,/v16_enforce_test_teacher_allowed/i);
  assert.match(sql,/v515_teacher_constraints/i);
  assert.match(sql,/TEACHER_NOT_CONFIGURED/i);
});

test('safe TEST apply blocks calendar mismatch before touching REAL structural fields',()=>{
  assert.match(sql,/create or replace function public\.v16_apply_test_teacher_plan/i);
  assert.match(sql,/rs\.class_name is distinct from ts\.class_name/i);
  assert.match(sql,/REAL_CALENDAR_RECONCILIATION_REQUIRED/i);
  assert.match(sql,/join public\.v515_sessions rs on rs\.id=ts\.real_session_id/i);
  assert.doesNotMatch(sql,/ta\.real_session_id/i);
});

test('safe apply updates only structural planning and keeps started-session guards',()=>{
  assert.match(sql,/teacher_id=ta\.teacher_id[\s\S]+manipulation_code=ta\.manipulation_code[\s\S]+room=ta\.room/i);
  assert.match(sql,/SESSION_ALREADY_STARTED/i);
  assert.match(sql,/sp\.session_id is not null/i);
  assert.doesNotMatch(sql,/update public\.attendance/i);
});

test('TEST clone seeds the approved six occurrence manipulation patterns instead of legacy manipulation values',()=>{
  assert.match(sql,/v16_official_manipulation/i);
  assert.match(sql,/array\['M1','M2','M3','M4'\]/i);
  assert.match(sql,/array\['M2','M3','M4','M1'\]/i);
  assert.match(sql,/array\['M3','M4','M1','M2'\]/i);
  assert.match(sql,/array\['M4','M1','M2','M3'\]/i);
  assert.match(sql,/array\['M5','M6','M5','M6'\]/i);
  assert.match(sql,/array\['M6','M5','M6','M5'\]/i);
  assert.match(sql,/2026-11-30[\s\S]+6/i);
});

test('TEST manipulation history also protects earlier REAL history outside the cloned window',()=>{
  assert.match(sql,/create or replace function private\.v16_enforce_test_group_manip_history/i);
  assert.match(sql,/rs\.session_date\s*<\s*v_session_date/i);
  assert.match(sql,/not exists\s*\([\s\S]+real_assignment_id=ra\.id/i);
  assert.match(sql,/REPEATED_GROUP_MANIPULATION/i);
});
