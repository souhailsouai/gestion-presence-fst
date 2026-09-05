const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const path='supabase/migrations/20260905074500_v16_fix_constraint_trigger_flush.sql';
const sql=fs.existsSync(path)?fs.readFileSync(path,'utf8'):'';

test('follow-up migration flushes deferred constraint triggers with SET CONSTRAINTS ALL',()=>{
  assert.match(sql,/create\s+or\s+replace\s+function\s+public\.v16_apply_test_teacher_plan/i);
  assert.match(sql,/set\s+constraints\s+all\s+immediate/i);
  assert.doesNotMatch(sql,/set\s+constraints\s+v16_real_room_conflict_guard\s+immediate/i);
});
