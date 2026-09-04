const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const path='supabase/migrations/20260904170500_v16_test_apply_preview.sql';
const sql=fs.existsSync(path)?fs.readFileSync(path,'utf8'):'';

function previewBody(){
  return sql.match(/create or replace function public\.v16_preview_test_apply\([\s\S]*?\n\$\$;/i)?.[0]||'';
}

test('TEST apply preview is an Admin-only read-only RPC',()=>{
  const body=previewBody();
  assert.ok(body,'v16_preview_test_apply migration/function missing');
  assert.match(body,/security invoker/i);
  assert.match(body,/auth\.uid\(\) is null/i);
  assert.match(body,/private\.is_admin\(\)/i);
  assert.match(body,/EFFECTIVE_DATE_REQUIRED/i);
  assert.doesNotMatch(body,/\bupdate\s+/i);
  assert.doesNotMatch(body,/\binsert\s+into\b/i);
  assert.doesNotMatch(body,/\bdelete\s+from\b/i);
  assert.match(sql,/revoke execute on function public\.v16_preview_test_apply\(date\) from public,anon/i);
  assert.match(sql,/grant execute on function public\.v16_preview_test_apply\(date\) to authenticated/i);
});

test('TEST apply preview mirrors critical structural preflight blockers',()=>{
  const body=previewBody();
  for(const marker of [
    'REAL_CALENDAR_RECONCILIATION_REQUIRED',
    'ROOM_REQUIRED',
    'SESSION_ALREADY_STARTED',
    'UNMAPPED_TEST_ASSIGNMENT',
    'REPEATED_GROUP_MANIPULATION',
    'TEST_WEEK_VALIDATION_FAILED'
  ])assert.match(body,new RegExp(marker,'i'),marker);
  assert.match(body,/private\.v16_verify_test_teacher_week/i);
  assert.match(body,/v515_teacher_constraints/i);
  assert.match(body,/structural_changes/i);
  assert.match(body,/current_count/i);
  assert.match(body,/proposed_count/i);
  assert.match(body,/weeks/i);
  assert.match(body,/blockers/i);
});
