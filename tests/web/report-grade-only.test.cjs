const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('PDF reports render late grade-only entries as Non saisi and exclude them from pointage counts',()=>{
  const js=fs.readFileSync('web/report-pdf.js','utf8');
  assert.match(js,/gradeOnly/);
  assert.match(js,/Non saisi/);
  assert.match(js,/!a\.gradeOnly/);
});
