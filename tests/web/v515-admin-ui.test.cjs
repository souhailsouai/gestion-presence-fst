const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const p='web/v515-admin-ui.js';

test('admin UI exposes the complete V5.15 planning console',()=>{
  assert.equal(fs.existsSync(p),true);
  const js=fs.readFileSync(p,'utf8');
  for(const marker of [
    'Configuration des classes','Groupes','Créneaux','Semaine A','Semaine B','Générer le planning','Ouvrir les demandes',
    'Enseignants','Quota','Manipulations','Candidats','Affecter','Postes non couverts','Vérifier le planning','Finaliser','Rattrapage'
  ]) assert.match(js,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),marker);
  for(const call of ['adminBootstrap','adminSnapshot','upsertClassConfig','createRosterGroup','upsertTimeslot','setFortnightPair','setTeacherConfig','generateCycle','openCycle','acceptRequest','rejectRequest','directAssign','verifyCycle','finalizeCycle','resetCycle'])
    assert.match(js,new RegExp(`FSTV515Api\\.${call}`),call);
  assert.match(js,/window\.FSTV515AdminUI=/);
});

test('direct assignment choices are filtered by manipulation, quota and time overlap',()=>{
  const js=fs.readFileSync(p,'utf8');
  assert.match(js,/function\s+eligibleTeachersForPosition/);
  assert.match(js,/remaining_quota/);
  assert.match(js,/manipulations/);
  assert.match(js,/assignment_teacher_id/);
  assert.match(js,/start_time\s*</);
  assert.match(js,/end_time\s*>/);
});
