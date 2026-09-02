const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const p='supabase/migrations/20260902191000_v515_rotation_rpcs.sql';

test('V5.15 rotation RPC contract exists',()=>{
  assert.equal(fs.existsSync(p),true);
  const sql=fs.readFileSync(p,'utf8');
  for(const fn of ['v515_generate_cycle','v515_open_cycle','v515_reset_cycle','v515_cancel_position','v515_create_catchup','v515_set_rotation_exception']) assert.match(sql,new RegExp(`function\\s+public\\.${fn}`,'i'),fn);
  assert.match(sql,/group_no\s*\+\s*o\.pedagogical_session_no\s*-\s*2/i);
  assert.match(sql,/mod\s*\([^;]*,\s*6\s*\)/i);
  assert.match(sql,/OPEN_FOR_REQUESTS/);
  assert.match(sql,/FINALIZED/);
  assert.match(sql,/REALIZED/);
});
