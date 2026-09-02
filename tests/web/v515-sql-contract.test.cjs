const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const p='supabase/migrations/20260902190000_v515_planning_schema.sql';

test('V5.15 schema contract exists',()=>{
  assert.equal(fs.existsSync(p),true);
  const sql=fs.readFileSync(p,'utf8');
  for(const name of [
    'v515_cycles','v515_class_config','v515_group_rosters','v515_timeslots',
    'v515_fortnight_pairs','v515_rotation','v515_teacher_config',
    'v515_teacher_manipulations','v515_session_positions','v515_requests',
    'v515_assignments','v515_audit_log'
  ]) assert.match(sql,new RegExp(`create\\s+table[^;]*${name}`,'i'),name);
  assert.match(sql,/group_count[\s\S]{0,160}check[\s\S]{0,160}between\s+1\s+and\s+6/i);
  assert.match(sql,/manipulation_code[\s\S]{0,220}check[\s\S]{0,220}M1/i);
  assert.match(sql,/classes_group_number_check/i);
  assert.match(sql,/student_groups_group_number_check/i);
});

test('V5.15 session positions have stable uniqueness for regular and catch-up rows',()=>{
  const sql=fs.readFileSync(p,'utf8');
  assert.match(sql,/create\s+unique\s+index[^;]*v515_positions_regular_uidx[^;]*where\s+source_position_id\s+is\s+null/is);
  assert.match(sql,/create\s+unique\s+index[^;]*v515_positions_catchup_source_uidx[^;]*where\s+source_position_id\s+is\s+not\s+null/is);
});
