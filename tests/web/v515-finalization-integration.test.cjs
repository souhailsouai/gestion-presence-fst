const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('V5.15 finalization and Web roster integration contract exists',()=>{
  const sqlPath='supabase/migrations/20260902194000_v515_finalize.sql';
  assert.equal(fs.existsSync(sqlPath),true);
  const sql=fs.readFileSync(sqlPath,'utf8');
  for(const fn of ['v515_verify_cycle','v515_finalize_cycle','v515_mark_realized'])
    assert.match(sql,new RegExp(`function\\s+public\\.${fn}`,'i'),fn);
  for(const code of ['UNCOVERED_POSITION','INCOMPLETE_ROTATION','DUPLICATE_MANIPULATION','QUOTA_EXCEEDED','MANIPULATION_NOT_ALLOWED','TEACHER_OVERLAP','ROSTER_MAPPING_MISSING'])
    assert.match(sql,new RegExp(code),code);
  assert.match(sql,/v515_position_id/);
  assert.match(sql,/manipulation_code/);

  assert.equal(fs.existsSync('web/access-control.js'),true);
  const js=fs.readFileSync('web/access-control.js','utf8');
  assert.match(js,/v515_visible_students/);
  assert.match(js,/v515_position_id/);
  assert.match(js,/manipulation_code/);
  assert.match(js,/room:x\.room/);
});
