const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');

const dir='supabase/migrations';
const names=fs.readdirSync(dir).filter(n=>n.includes('v515_')).sort();
const core=fs.readFileSync(path.join(dir,'20260903150000_v515_planning_core.sql'),'utf8');
const grants=fs.readFileSync(path.join(dir,'20260903150100_v515_planning_grants.sql'),'utf8');
const rpcs=fs.readFileSync(path.join(dir,'20260903150200_v515_planning_rpcs.sql'),'utf8');
const seed=fs.readFileSync(path.join(dir,'20260903150300_v515_planning_2026_2027.sql'),'utf8');
const admin=fs.readFileSync(path.join(dir,'20260903150400_v515_admin_configuration.sql'),'utf8');
const integration=fs.readFileSync(path.join(dir,'20260903150500_v515_legacy_integration.sql'),'utf8');
const cleanup=fs.readFileSync(path.join(dir,'20260903150600_v515_request_cleanup.sql'),'utf8');
const pdfPolicy=fs.readFileSync(path.join(dir,'20260903150700_v515_pdf_schedule_policy.sql'),'utf8');

test('V5.15 migrations have unique ordered versions',()=>{
  assert.deepEqual(names,[
    '20260903150000_v515_planning_core.sql','20260903150100_v515_planning_grants.sql','20260903150200_v515_planning_rpcs.sql',
    '20260903150300_v515_planning_2026_2027.sql','20260903150400_v515_admin_configuration.sql','20260903150500_v515_legacy_integration.sql',
    '20260903150600_v515_request_cleanup.sql','20260903150700_v515_pdf_schedule_policy.sql'
  ]);
});

test('all V5.15 exposed tables enable RLS',()=>{
  for(const t of ['cycles','class_pairs','groups','manipulations','sessions','teacher_constraints','requests','assignments','waivers','audit_log'])assert.match(core,new RegExp(`alter table public\\.v515_${t} enable row level security`,'i'),t);
  assert.match(pdfPolicy,/alter table public\.v515_teacher_day_pool enable row level security/i);
});

test('ownership, admin and assignment invariants are server-side',()=>{
  assert.match(core,/teacher_id=\(select auth\.uid\(\)\)/);
  assert.match(core,/private\.is_admin\(\)/);
  assert.match(rpcs,/allowed_manipulations/);
  assert.match(rpcs,/Quota enseignant atteint/);
  assert.match(rpcs,/Enseignant déjà affecté sur ce créneau/);
  assert.match(rpcs,/Rotation incohérente avec le cycle M1-M6/);
  assert.match(rpcs,/Salle déjà utilisée sur ce créneau/);
  assert.match(rpcs,/pg_advisory_xact_lock/);
  assert.match(rpcs,/hashtextextended\('v515-teacher\|'/);
  assert.match(rpcs,/hashtextextended\('v515-room\|'/);
});

test('PDF fixes manipulation rooms and keeps day teacher pool admin-editable',()=>{
  assert.match(pdfPolicy,/\('M1','C'\)/);
  assert.match(pdfPolicy,/\('M2','B'\)/);
  assert.match(pdfPolicy,/\('M3','D'\)/);
  assert.match(pdfPolicy,/\('M4','D'\)/);
  assert.match(pdfPolicy,/\('M5','A'\)/);
  assert.match(pdfPolicy,/\('M6','A'\)/);
  assert.match(pdfPolicy,/v515_teacher_day_pool/);
  assert.match(pdfPolicy,/Khaoula Rais/);
  assert.match(pdfPolicy,/Souhail Souai/);
  assert.match(pdfPolicy,/Nadia Bouaziz/);
  assert.match(pdfPolicy,/Olfa Turki/);
  assert.match(pdfPolicy,/Tarek Sbeouelji/);
  assert.match(pdfPolicy,/Mouna Triki/);
  assert.match(pdfPolicy,/ROOM_NOT_ALLOWED/);
  assert.match(pdfPolicy,/TEACHER_NOT_ALLOWED_TODAY/);
  assert.match(pdfPolicy,/v515_set_teacher_day_pool/);
});

test('room and legacy presence-plan linkage are explicit',()=>{
  assert.match(core,/room text not null check\(room in \('A','B','C','D'\)\)/);
  assert.match(core,/legacy_plan_id uuid unique references public\.session_plans/);
  assert.match(integration,/v515_materialize_session_plans/);
  assert.match(integration,/sp\.session_id is not null/);
  assert.match(integration,/sp\.session_id is null/);
  assert.match(integration,/legacy_plan_id=v_plan/);
  assert.match(integration,/private\.mutation_allowed\(\)/);
});

test('cycle closure uses actual completed attendance sessions and rejects duplicates',()=>{
  assert.match(rpcs,/join public\.session_plans sp on sp\.id=a\.legacy_plan_id/);
  assert.match(rpcs,/join public\.sessions ls on ls\.id=sp\.session_id/);
  assert.match(rpcs,/ls\.completed_at is not null/);
  assert.match(rpcs,/DUPLICATE_MANIPULATION/);
});

test('competing pending requests are rejected after a post is assigned',()=>{
  assert.match(cleanup,/after insert on public\.v515_assignments/);
  assert.match(cleanup,/status='rejected'/);
  assert.match(cleanup,/session_id=new\.session_id/);
  assert.match(cleanup,/group_no=new\.group_no/);
});

test('privileged functions are not executable by anon or PUBLIC',()=>{
  for(const fn of ['v515_request_assignment','v515_cancel_request','v515_assign_teacher','v515_validate_request','v515_finalize_assignments','v515_close_cycle'])assert.match(rpcs,new RegExp(`revoke execute on function public\\.${fn}\\(`,'i'),fn);
  assert.match(rpcs,/revoke execute on function private\.v515_audit/);
  assert.match(integration,/revoke execute on function public\.v515_materialize_session_plans/);
  assert.match(cleanup,/revoke execute on function private\.v515_reject_competing_requests/);
  assert.match(pdfPolicy,/revoke execute on function public\.v515_set_teacher_day_pool/);
  assert.match(rpcs,/security definer set search_path=''/i);
});

test('invoker write privileges are explicit and audit DML is not exposed',()=>{
  assert.match(grants,/grant insert,update on public\.v515_requests to authenticated/);
  assert.match(grants,/grant insert,update,delete on public\.v515_assignments to authenticated/);
  assert.match(grants,/revoke all on public\.v515_audit_log from anon,authenticated/);
});

test('seed is safe to re-run only while still an empty draft',()=>{
  assert.match(seed,/ALREADY_INITIALIZED/);
  assert.match(seed,/v_status<>'draft'/);
  assert.match(seed,/exists\(select 1 from public\.v515_assignments/);
  assert.match(admin,/legacy_plan_id is not null/);
});

test('no service_role secret is introduced in V5.15 implementation',()=>{
  const combined=[core,grants,rpcs,seed,admin,integration,cleanup,pdfPolicy,fs.readFileSync('web/v515-planning-core.js','utf8'),fs.readFileSync('web/v515-planning-2026-2027.js','utf8')].join('\n');
  assert.doesNotMatch(combined,/service_role/i);
});
