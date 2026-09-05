const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const path='supabase/migrations/20260905080000_fix_completed_session_grade_rpc.sql';
const sql=fs.existsSync(path)?fs.readFileSync(path,'utf8'):'';

test('completed-session teacher grade save supports existing and grade-only rows without changing attendance',()=>{
  assert.match(sql,/create\s+or\s+replace\s+function\s+private\.save_attendance_sheet_impl/i);
  assert.match(sql,/v_session\.completed_at\s+is\s+not\s+null\s+and\s+not\s+v_admin/i);
  assert.match(sql,/if\s+exists\s*\(\s*select\s+1\s+from\s+public\.attendance/i);
  assert.match(sql,/update\s+public\.attendance[\s\S]+set\s+grade\s*=\s*v_grade/i);
  assert.match(sql,/insert\s+into\s+public\.attendance\([\s\S]*grade_only[\s\S]*\)[\s\S]*values\([\s\S]*'present'[\s\S]*''[\s\S]*true/i);
  assert.match(sql,/elsif\s+v_grade\s+is\s+not\s+null\s+then/i);
});

test('completed-session teacher path never updates status comment or grade_only on existing attendance',()=>{
  const teacherBranch=sql.match(/if\s+v_session\.completed_at\s+is\s+not\s+null\s+and\s+not\s+v_admin\s+then([\s\S]*?)else/i)?.[1]||'';
  assert.ok(teacherBranch,'completed-session teacher branch missing');
  const update=teacherBranch.match(/update\s+public\.attendance[\s\S]*?where[\s\S]*?;/i)?.[0]||'';
  assert.ok(update,'grade update missing');
  assert.doesNotMatch(update,/set[\s\S]*status\s*=/i);
  assert.doesNotMatch(update,/set[\s\S]*comment\s*=/i);
  assert.doesNotMatch(update,/set[\s\S]*grade_only\s*=/i);
});
