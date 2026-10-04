const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const sql=fs.readFileSync('supabase/migrations/20261004_v31_attendance_grade_origin.sql','utf8');
test('migration distinguishes manual and automatic absence zero',()=>{
 assert.match(sql,/grade_origin/);
 assert.match(sql,/absence_auto/);
 assert.match(sql,/manual_grade_backup/);
 assert.match(sql,/if v_status='absent'/);
 assert.match(sql,/elsif v_status='justifie'/);
});
test('migration enforces strict LPC3 owner boundary across access helpers',()=>{
 assert.match(sql,/private\.is_lpc3_owner/);
 assert.match(sql,/c\.module='TP Ondes et Vibrations' and private\.is_lpc3_owner/);
 assert.match(sql,/create policy sessions_select_authorized/);
 assert.match(sql,/create policy students_select_authorized/);
 assert.match(sql,/create policy classes_insert_authorized/);
 assert.match(sql,/create policy sessions_insert_authorized/);
 assert.match(sql,/create policy students_insert_authorized/);
});
