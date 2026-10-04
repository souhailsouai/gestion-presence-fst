const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const transform=fs.readFileSync('scripts/fst_shell_transform.py','utf8');
const attendance=fs.readFileSync('web/attendance-policy.js','utf8');
const access=fs.readFileSync('web/access-control.js','utf8');
const migration=fs.readFileSync('supabase/migrations/20261004195500_teacher_assigned_write_access.sql','utf8');

test('teacher student creation removes INSERT RETURNING that conflicts with RLS',()=>{
  assert.match(transform,/_fix_teacher_write_paths/);
  assert.match(transform,/from\('students'\)\.insert/);
  assert.match(transform,/Expected one legacy teacher student INSERT \.\.\. RETURNING path/);
  assert.doesNotMatch(transform,/subn\([\s\S]*\.select\('id'\)[\s\S]*replacement/i);
});

test('teacher attendance reload trusts RLS instead of legacy attendance owner id',()=>{
  assert.match(attendance,/const attendanceQ=supabaseClient\.from\('attendance'\)\.select\('\*'\);/);
  assert.doesNotMatch(attendance,/attendanceQ=.*eq\('teacher_id',currentTeacher\.id\)/);
  assert.match(access,/attendanceQ=supabaseClient\.from\('attendance'\)\.select\('\*'\)/);
  assert.doesNotMatch(access,/attendanceQ=.*eq\('teacher_id',owner\)/);
});

test('session RLS recognizes official session-plan assignment and preserves LPC3 owner guard',()=>{
  assert.match(migration,/sp\.teacher_id=\(select auth\.uid\(\)\)/);
  assert.match(migration,/sp\.session_id=s\.id/);
  assert.match(migration,/sp\.class_id=s\.class_id/);
  assert.match(migration,/sp\.plan_date=s\.session_date/);
  assert.match(migration,/c\.module='TP Ondes et Vibrations' and private\.is_lpc3_owner\(\)/);
});
