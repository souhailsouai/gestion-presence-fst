const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const p='supabase/migrations/20260902192000_v515_assignment_rpcs.sql';

test('V5.15 assignment RPC contract exists',()=>{
  assert.equal(fs.existsSync(p),true);
  const sql=fs.readFileSync(p,'utf8');
  for(const fn of ['v515_set_teacher_config','v515_submit_request','v515_cancel_request','v515_accept_request','v515_reject_request','v515_direct_assign','v515_assert_assignment_allowed'])
    assert.match(sql,new RegExp(`function\\s+public\\.${fn}`,'i'),fn);
  for(const code of ['QUOTA_REACHED','MANIPULATION_NOT_ALLOWED','TEACHER_OVERLAP','POSITION_ALREADY_ASSIGNED','TEACHER_INACTIVE'])
    assert.match(sql,new RegExp(code),code);
  assert.match(sql,/start_time\s*<\s*p\.end_time/i);
  assert.match(sql,/end_time\s*>\s*p\.start_time/i);
});
