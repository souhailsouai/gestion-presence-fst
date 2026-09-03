const fs=require('node:fs');
const test=require('node:test');
const assert=require('node:assert/strict');

const core=fs.readFileSync('supabase/migrations/20260903_v515_planning_core.sql','utf8');
const rpcs=fs.readFileSync('supabase/migrations/20260903_v515_planning_rpcs.sql','utf8');
const grants=fs.readFileSync('supabase/migrations/20260903_v515_planning_grants.sql','utf8');

test('all V5.15 exposed tables enable RLS',()=>{
  const tables=['cycles','class_pairs','groups','manipulations','sessions','teacher_constraints','requests','assignments','waivers','audit_log'];
  for(const t of tables){
    assert.match(core,new RegExp(`alter table public\\.v515_${t} enable row level security`,'i'),t);
  }
});

test('teacher ownership and server-side admin checks are present',()=>{
  assert.match(core,/teacher_id = \(select auth\.uid\(\)\)/);
  assert.match(core,/private\.is_admin\(\)/);
  assert.match(rpcs,/auth\.uid\(\)/);
  assert.match(rpcs,/private\.is_admin\(\)/);
  assert.match(rpcs,/allowed_manipulations/);
  assert.match(rpcs,/Quota enseignant atteint/);
  assert.match(rpcs,/Enseignant déjà affecté sur ce créneau/);
  assert.match(rpcs,/Rotation incohérente avec le cycle M1-M6/);
});

test('privileged functions are not executable by anon or PUBLIC',()=>{
  for(const fn of ['v515_request_assignment','v515_cancel_request','v515_assign_teacher','v515_validate_request','v515_finalize_assignments','v515_close_cycle']){
    assert.match(rpcs,new RegExp(`revoke execute on function public\\.${fn}\\(`,'i'),fn);
  }
  assert.match(rpcs,/revoke execute on function private\.v515_audit/);
  assert.match(rpcs,/security definer\s+set search_path = ''/i);
});

test('invoker RPC write privileges are explicit and audit table stays protected',()=>{
  assert.match(grants,/grant insert, update on public\.v515_requests to authenticated/);
  assert.match(grants,/grant insert, update, delete on public\.v515_assignments to authenticated/);
  assert.match(grants,/revoke insert, update, delete on public\.v515_audit_log from authenticated/);
});

test('no service_role secret is introduced in V5.15 implementation',()=>{
  const combined=[core,rpcs,grants,fs.readFileSync('web/v515-planning-core.js','utf8'),fs.readFileSync('web/v515-planning-2026-2027.js','utf8')].join('\n');
  assert.doesNotMatch(combined,/service_role/i);
});
