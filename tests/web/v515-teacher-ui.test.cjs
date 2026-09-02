const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const p='web/v515-teacher-ui.js';

test('teacher UI exposes required V5.15 session-choice controls',()=>{
  assert.equal(fs.existsSync(p),true);
  const js=fs.readFileSync(p,'utf8');
  for(const marker of ['Choix des séances','Quota total','Validées','En attente','Restantes','v515-filter-class','v515-filter-date','v515-filter-manipulation','v515-filter-week','v515-filter-status','Demander','Annuler'])
    assert.match(js,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),marker);
  assert.match(js,/FSTV515Api\.availablePositions/);
  assert.match(js,/FSTV515Api\.submitRequest/);
  assert.match(js,/FSTV515Api\.cancelRequest/);
  assert.match(js,/window\.FSTV515TeacherUI=/);
});
