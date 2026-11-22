const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const opPath = path.join(__dirname,'../../supabase/ops/2026-11-22_pc1_add_arfaoui_fares.sql');

test('PC1 operation adds Arfaoui Fares to PC1-A-G3 without deleting anyone',()=>{
  assert.equal(fs.existsSync(opPath),true,'Arfaoui Fares SQL operation is missing');
  const sql=fs.readFileSync(opPath,'utf8');
  assert.match(sql,/'Arfaoui', 'Fares'/);
  assert.match(sql,/c\.name='PC1-A-G3'/);
  assert.match(sql,/not exists\(/);
  assert.match(sql,/expected 46 active students/);
  assert.match(sql,/expected 8 active students/);
  assert.doesNotMatch(sql,/delete\s+from\s+public\.students/i);
});
