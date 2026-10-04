const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const source=fs.readFileSync('web/v31-export-ui.js','utf8');
test('export UI separates MPI1-PC1 and LPC3',()=>{
 assert.match(source,/Suivi|Exports de suivi MPI1-PC1/);
 assert.match(source,/environment==='LPC3'/);
 assert.match(source,/V30LPC3\?\.isOwner/);
 assert.match(source,/session_plans/);
 assert.match(source,/manipulation/);
});
test('LPC3 remains absent from generic MPI models by environment filter',()=>{
 assert.match(source,/environmentForClass\(c\)===environment/);
});
