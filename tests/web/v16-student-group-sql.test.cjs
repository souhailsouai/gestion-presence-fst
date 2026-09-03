const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const membershipPath='supabase/migrations/20260903170200_v16_student_group_history.sql';
const rosterPath='supabase/migrations/20260903170300_v16_session_rosters.sql';
const membership=fs.existsSync(membershipPath)?fs.readFileSync(membershipPath,'utf8'):'';
const roster=fs.existsSync(rosterPath)?fs.readFileSync(rosterPath,'utf8'):'';

test('V16 stores effective-dated student group membership separately from historical attendance',()=>{
  assert.ok(membership.length>0,'student membership migration missing');
  assert.match(membership,/create table public\.v16_student_group_memberships/i);
  for(const column of ['student_id uuid','class_id uuid','group_no integer','effective_from date','effective_to date','active boolean','changed_by uuid','created_at timestamptz'])assert.match(membership,new RegExp(column.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'),column);
  assert.match(membership,/group_no between 1 and 4/i);
  assert.match(membership,/exclude using gist/i);
  assert.match(membership,/daterange\s*\(/i);
  assert.match(membership,/with &&/i);
  assert.doesNotMatch(membership,/update\s+public\.attendance/i);
});

test('group mutation RPC is Admin-only, audited and effective dated',()=>{
  assert.match(membership,/create or replace function public\.v16_set_student_group\s*\(/i);
  assert.match(membership,/p_student_id uuid/i);assert.match(membership,/p_class_id uuid/i);assert.match(membership,/p_group_no integer/i);assert.match(membership,/p_effective_from date/i);
  assert.match(membership,/security invoker/i);assert.match(membership,/set search_path\s*=\s*''/i);assert.match(membership,/private\.is_admin\(\)/i);
  assert.match(membership,/effective_to\s*=\s*p_effective_from/i);
  assert.match(membership,/v16_student_group_changed/i);assert.match(membership,/private\.v515_audit/i);assert.match(membership,/changed_by/i);assert.match(membership,/auth\.uid\(\)/i);
});

test('ending a membership is Admin-only and preserves all old attendance facts',()=>{
  assert.match(membership,/create or replace function public\.v16_end_student_membership\s*\(/i);assert.match(membership,/p_effective_to date/i);
  assert.match(membership,/effective_to\s*=\s*p_effective_to/i);assert.match(membership,/active\s*=\s*false/i);assert.match(membership,/v16_student_membership_ended/i);
  assert.doesNotMatch(membership,/update\s+(?:public\.)?attendance\s+set/i);
  for(const field of ['student_id','session_id','grade','status'])assert.doesNotMatch(membership,new RegExp(`attendance[\\s\\S]{0,120}${field}\\s*=`,'i'));
});

test('membership table is readable to authenticated users but mutations are RLS Admin-only',()=>{
  assert.match(membership,/enable row level security/i);assert.match(membership,/grant select,insert,update,delete on public\.v16_student_group_memberships to authenticated/i);assert.match(membership,/create policy v16_student_memberships_read/i);
  assert.match(membership,/create policy v16_student_memberships_admin_insert[\s\S]+for insert to authenticated[\s\S]+private\.is_admin\(\)/i);
  assert.match(membership,/create policy v16_student_memberships_admin_update[\s\S]+for update to authenticated[\s\S]+private\.is_admin\(\)/i);
  assert.match(membership,/create policy v16_student_memberships_admin_delete[\s\S]+for delete to authenticated[\s\S]+private\.is_admin\(\)/i);
  assert.doesNotMatch(membership,/teacher_id\s*=\s*\(select auth\.uid\(\)\)/i);
  assert.match(membership,/revoke execute on function public\.v16_set_student_group/i);assert.match(membership,/grant execute on function public\.v16_set_student_group/i);
});

test('dated roster resolver selects membership valid on the session date',()=>{
  assert.ok(roster.length>0,'session roster migration missing');
  assert.match(roster,/create or replace function public\.v16_students_for_session\s*\(/i);
  assert.match(roster,/p_session_id uuid/i);assert.match(roster,/p_context text default 'real'/i);
  assert.match(roster,/m\.effective_from\s*<=\s*s\.session_date/i);
  assert.match(roster,/m\.effective_to is null or s\.session_date\s*<\s*m\.effective_to/i);
  assert.match(roster,/c\.name\s*=\s*s\.class_name/i);
  assert.match(roster,/m\.group_no/i);
  assert.doesNotMatch(roster,/m\.active\s*=\s*true/i);
  assert.doesNotMatch(roster,/update\s+(?:public\.)?attendance/i);
});

test('dated roster supports additions, endings and later reactivation through date windows',()=>{
  assert.match(roster,/order by\s+m\.group_no/i);
  assert.match(roster,/effective_from/i);assert.match(roster,/effective_to/i);
  assert.match(roster,/student_id/i);assert.match(roster,/last_name/i);assert.match(roster,/first_name/i);
  assert.match(roster,/revoke execute on function public\.v16_students_for_session/i);assert.match(roster,/grant execute on function public\.v16_students_for_session/i);
  assert.match(roster,/TEST_CONTEXT_NOT_READY/i);
});
