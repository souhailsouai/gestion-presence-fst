const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const source=fs.readFileSync('web/v30-lpc3.js','utf8');
const build=fs.readFileSync('scripts/build_online_web.py','utf8');
const single=fs.readFileSync('scripts/build_single_file_release.py','utf8');

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

test('LPC3 schedule uses 08h30-11h30 in Salle Onde and preserves holiday handling',()=>{
  assert.match(source,/const START='08:30'/);
  assert.match(source,/const END='11:30'/);
  assert.match(source,/const ROOM='Onde'/);
  assert.match(source,/15\/10\/2026 : jour férié/);
  assert.match(source,/rattrapage final de G4 reste à fixer/);
  assert.equal((source.match(/\['2026-/g)||[]).length,19);
});

test('LPC3 module is included in online and standalone builds',()=>{
  assert.match(build,/v30-lpc3\.js/);
  assert.match(single,/v30_lpc3_path/);
  assert.match(single,/data-fst-v30-lpc3/);
  assert.match(single,/V30LPC3/);
});
