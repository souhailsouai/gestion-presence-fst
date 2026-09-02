const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const p='supabase/migrations/20260902192500_v515_config_rpcs.sql';

test('V5.15 admin configuration RPC contract exists',()=>{
  assert.equal(fs.existsSync(p),true);
  const sql=fs.readFileSync(p,'utf8');
  for(const fn of ['v515_upsert_cycle','v515_upsert_class_config','v515_set_group_roster','v515_create_roster_group','v515_upsert_timeslot','v515_set_fortnight_pair'])
    assert.match(sql,new RegExp(`function\\s+public\\.${fn}`,'i'),fn);
  assert.match(sql,/group_count[^;]*between\s+1\s+and\s+6/i);
  assert.match(sql,/CYCLE_NOT_DRAFT/);
  assert.match(sql,/TP Physique/);
});

test('V5.15 cycle config uses the real academic_years archive column',()=>{
  const sql=fs.readFileSync(p,'utf8');
  assert.doesNotMatch(sql,/academic_years[^;]{0,200}deleted_at/i);
  assert.match(sql,/academic_years[^;]{0,240}archived_at/i);
});

test('V5.15 configuration SQL avoids PLpgSQL variable and table-alias shadowing',()=>{
  const sql=fs.readFileSync(p,'utf8');
  assert.doesNotMatch(sql,/select\s+cc\.\*\s+into\s+cc\b/i);
  assert.doesNotMatch(sql,/for\s+update\s+of\s+cc\b/i);
});
