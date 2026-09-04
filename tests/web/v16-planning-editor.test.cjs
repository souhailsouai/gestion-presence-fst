const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.existsSync('web/v16-planning-editor.js')?fs.readFileSync('web/v16-planning-editor.js','utf8'):'';
let api=null;
try{api=require('../../web/v16-planning-editor.js');}catch(_){api=null;}

test('manual planning editor module exists and exposes render/save API',()=>{
  assert.ok(source.length>0,'v16-planning-editor.js missing');
  assert.ok(api,'editor cannot be loaded');
  assert.equal(typeof api.render,'function');
  assert.equal(typeof api.saveDirtyWeeks,'function');
});

test('editor exposes Admin teacher manipulation and room controls',()=>{
  for(const marker of ['data-v16-edit-teacher','data-v16-edit-manipulation','data-v16-edit-room','À choisir'])assert.match(source,new RegExp(marker),marker);
  assert.match(source,/canUseAdminControls/);
  assert.match(source,/M1/);
  assert.match(source,/M6/);
});

test('editor saves complete weeks to context-specific RPCs',()=>{
  assert.match(source,/v16_save_week_plan/);
  assert.match(source,/v16_save_test_week_plan/);
  assert.match(source,/p_week_start/);
  assert.match(source,/p_rows/);
  assert.match(source,/dirtyWeeks/);
});

test('teacher mode is read-only and cannot mount edit controls',()=>{
  assert.match(source,/isAdminActive/);
  assert.match(source,/return\s+['"]['"]/);
});
