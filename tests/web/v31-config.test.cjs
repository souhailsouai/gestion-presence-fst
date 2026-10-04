const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../../web/v31-config.js');

test('V31 application version is centralized and discreetly formatted',()=>{
  assert.equal(C.APP_VERSION,'3.1');
  assert.equal(C.APP_VERSION_LABEL,'v3.1');
  assert.equal(C.ACADEMIC_YEAR,'2026/2027');
  assert.equal(C.ACADEMIC_YEAR_FILE,'2026_2027');
  assert.match(C.INSTITUTION_SHORT,/FST/);
  assert.match(C.INSTITUTION_SHORT,/Tunis El Manar/);
});
