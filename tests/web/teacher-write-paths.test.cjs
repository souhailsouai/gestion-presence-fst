const fs=require('node:fs');
const test=require('node:test');
const assert=require('node:assert/strict');

test('teacher student creation uses INSERT, not UPSERT',()=>{
  const src=fs.readFileSync('web/online-runtime.js','utf8');
  const block=src.match(/window\.addStudent=async function\(\)\{[\s\S]*?\n  \};/);
  assert.ok(block,'addStudent block not found');
  assert.match(block[0],/insertRows\('students'/);
  assert.doesNotMatch(block[0],/upsert\('students'/);
});

test('completed own session remains editable for attendance, comments and grades',()=>{
  const src=fs.readFileSync('web/session-editing.js','utf8');
  assert.doesNotMatch(src,/présence et commentaires verrouillés/);
  assert.match(src,/Présence, commentaires et notes modifiables/);
});
