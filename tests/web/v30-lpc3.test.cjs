const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const source=fs.readFileSync('web/v30-lpc3.js','utf8');
const build=fs.readFileSync('scripts/build_pages_from_41881.py','utf8');
const single=fs.readFileSync('scripts/build_pages_from_41881.py','utf8');

test('LPC3 has a dedicated private section for Souhail Souai',()=>{
  assert.match(source,/const OWNER_ID='e9a874d5-4e7e-48f2-a8bd-d59003599570'/);
  assert.match(source,/id='lpc3-nav-tab'|lpc3-nav-tab/);
  assert.match(source,/presence-lpc3/);
  assert.match(source,/Présence LPC3/);
  assert.match(source,/isOwner\(\)/);
});

test('LPC3 keeps Ondes et Vibrations separate from generic TP Physique',()=>{
  assert.match(source,/TP Ondes et Vibrations/);
  assert.match(source,/isolateGenericUi/);
  assert.match(source,/LPC3/);
  assert.doesNotMatch(source,/module='TP Physique'/);
});

