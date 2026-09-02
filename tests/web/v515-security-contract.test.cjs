const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const p='supabase/migrations/20260902193000_v515_rls_and_views.sql';

test('V5.15 RLS and read-model contract exists',()=>{
  assert.equal(fs.existsSync(p),true);
  const sql=fs.readFileSync(p,'utf8');
  for(const table of ['v515_cycles','v515_class_config','v515_group_rosters','v515_timeslots','v515_fortnight_pairs','v515_rotation','v515_teacher_config','v515_teacher_manipulations','v515_session_positions','v515_requests','v515_assignments','v515_audit_log'])
    assert.match(sql,new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`,'i'),table);
  for(const fn of ['v515_my_dashboard','v515_available_positions','v515_my_requests','v515_my_assignments','v515_admin_snapshot','v515_visible_students'])
    assert.match(sql,new RegExp(`function\\s+public\\.${fn}`,'i'),fn);
  assert.match(sql,/security\s+definer/i);
  assert.match(sql,/set\s+search_path\s*=\s*public\s*,\s*pg_temp/i);
  assert.match(sql,/revoke\s+all\s+on\s+function/i);
});

test('V5.15 exposes an admin bootstrap read model',()=>{
  const sql=fs.readFileSync(p,'utf8');
  assert.match(sql,/function\s+public\.v515_admin_bootstrap/i);
  for(const marker of ['academic_years','class_families','teachers','cycles']) assert.match(sql,new RegExp(marker),marker);
});
