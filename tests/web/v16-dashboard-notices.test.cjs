const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.existsSync('web/v16-dashboard-notices.js')?fs.readFileSync('web/v16-dashboard-notices.js','utf8'):'';
let api=null;
try{api=require('../../web/v16-dashboard-notices.js');}catch(_){api=null;}

test('dashboard notices module exists and exposes idempotent mount',()=>{
  assert.ok(source.length>0,'v16-dashboard-notices.js missing');
  assert.ok(api,'module cannot be loaded');
  assert.equal(typeof api.mount,'function');
  assert.match(source,/data-v16-dashboard-notices/);
  assert.match(source,/getElementById\(['"]dashboard['"]\)/);
});

test('MPI1 and PC1 notices contain corrected official values',()=>{
  for(const marker of [
    'Avis n°1','MPI1-A','MPI1-E','13h45','MPI1-C','MPI1-D','13h30','MPI1-B','PC1-A',
    'Salles A, B, C et D','11/09/2026','Souhail Souai','souhail.souai@fst.utm.tn'
  ])assert.match(source,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i'),marker);
  assert.doesNotMatch(source,/PC1-A[^\n]{0,160}13h15/i);
});

test('notices explicitly show corrected Thursday and Friday start times',()=>{
  assert.match(source,/MPI1-C[\s\S]{0,180}13h30/i);
  assert.match(source,/PC1-A[\s\S]{0,180}13h30/i);
});
