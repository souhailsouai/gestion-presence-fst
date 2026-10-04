const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const source=fs.readFileSync('web/session-editing.js','utf8');
test('session editor uses V31 grade origin invariant',()=>{
 assert.match(source,/applyAttendanceGradeRule/);
 assert.match(source,/gradeOrigin='manual'/);
 assert.match(source,/status==='absent'\|\|a\.status==='justifie'/);
 assert.match(source,/La note est imposée à 0/);
});
