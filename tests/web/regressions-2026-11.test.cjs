// Tests de non-régression pour les erreurs réelles corrigées en novembre 2026.
// Règle : chaque erreur constatée en production reçoit un test ici avant d'être considérée comme corrigée.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const C=require('../../web/v33-s2-core.js');

const read=p=>fs.readFileSync(p,'utf8');

test('LPC3 : dernière séance de TP le 26/11/2026, examen le 10/12/2026, rien après',()=>{
  const src=read('web/v30-lpc3.js');
  const dates=[...src.matchAll(/\['(\d{4}-\d{2}-\d{2})','LPC3-G\d'\]/g)].map(m=>m[1]);
  assert.ok(dates.length>0);
  assert.equal(dates.sort().at(-1),'2026-11-26');
  assert.match(src,/EXAM_DATE='2026-12-10'/);
});

test('S2 : 5 groupes et 5 manipulations par défaut',()=>{
  assert.match(read('web/v33-s2-core.js'),/group_count:5,manip_count:5/);
  assert.match(read('web/v33-semestres.js'),/group_count:5,manip_count:5/);
  assert.match(read('app-native/src/main/java/tn/utm/fst/gestionpresence/nativeapp/feature/s2/S2Admin.kt'),/"group_count"\) \?: 5/);
});

test('S2 à 5 groupes × 5 manipulations : chaque groupe fait chaque manipulation une fois en 5 séances',()=>{
  const settings={start_date:'2027-01-11',end_date:'2027-04-30',group_count:5,manip_count:5};
  const manipulations=['M1','M2','M3','M4','M5'].map(code=>({code,room:'A'}));
  const stations=manipulations.map((m,i)=>({weekday:1,manipulation_code:m.code,teacher_id:'t'+i}));
  const classSlots=[{class_name:'MPI1-A',weekday:1,start_time:'14:00',end_time:'17:00',pair_key:'lundi',pair_order:1,mode:'alternance'}];
  const {sessions,warnings}=C.generatePlan({settings,classSlots,stations,manipulations});
  assert.deepEqual(warnings,[]);
  assert.equal(sessions.length,5);
  for(let g=1;g<=5;g++){
    const seen=sessions.map(s=>s.slots.find(x=>x.group_no===g).manipulation_code).sort();
    assert.deepEqual(seen,['M1','M2','M3','M4','M5']);
  }
  assert.ok(sessions.every(s=>s.slots.length===5));
});

test('S1 : salles fixes M1→C, M2/M5→B, M3/M6→A, M4→D (site)',()=>{
  for(const f of ['web/v515-planning-admin-actions.js','web/v515-planning-2026-2027.js'])
    assert.match(read(f),/M1:'C',M2:'B',M3:'A',M4:'D',M5:'B',M6:'A'/,f);
});

test('Application : le planning S1 vient du planning réel (session_plans), 6 groupes avec enseignant',()=>{
  const api=read('app-native/src/main/java/tn/utm/fst/gestionpresence/nativeapp/data/remote/OnlineApiClient.kt');
  assert.match(api,/suspend fun s1Plan[\s\S]{0,1200}"session_plans"/);
});

test('Connexion : la double authentification est facultative (V41, demande du 24/11/2026)',()=>{
  const sql=read('supabase/migrations/20261124080000_v41_mfa_facultative.sql');
  assert.match(sql,/set mfa_required = false/);
  assert.match(sql,/"optional"/);
  assert.doesNotMatch(sql,/'aal2'/);
});

test('Sécurité : la clé de publication Android ne peut pas être versionnée',()=>{
  const gi=read('.gitignore');
  assert.match(gi,/^keystore\.properties$/m);
  assert.match(gi,/^\*\.jks$/m);
  assert.doesNotMatch(read('app-native/build.gradle.kts'),/storePassword\s*=\s*"/);
});

test('application Android : vise l\'API 36 (exigence Google Play depuis le 31/08/2026)', () => {
  const g = fs.readFileSync(path.join(__dirname, '..', '..', 'app-native', 'build.gradle.kts'), 'utf8');
  assert.match(g, /targetSdk = 3[6-9]/);
  assert.match(g, /compileSdk = 3[6-9]/);
});

test('Avis : le site respecte la période d\'affichage (avis S2 à partir du 12/12/2026)',()=>{
  const js=read('web/v32-notices.js');
  assert.match(js,/starts_on,ends_on/);
  assert.match(js,/ph==='actuel'/);
  const sql=read('supabase/migrations/20261124140000_v42_avis_s2.sql');
  assert.match(sql,/date '2026-12-12'/);
  assert.match(sql,/S2 — Démarrage des TP MPI1/);
  assert.match(sql,/S2 — Démarrage des TP PC1/);
});

test('Espaces S2 (V43) : tables par espace, droits par espace, super administrateur',()=>{
  const sql=read('supabase/migrations/20261125210000_v43_espaces_s2.sql');
  assert.match(sql,/create table public\.spaces/);
  assert.match(sql,/private\.can_admin_space\(space_id\)/);
  assert.match(sql,/Seul le super administrateur nomme ou retire un administrateur/);
  const fn=read('supabase/migrations/20261125211000_v43b_fonctions_s2_par_espace.sql');
  assert.match(fn,/p_space uuid default '00000000-0000-4000-8000-000000000001'/);
  const js=read('web/v33-semestres.js');
  assert.match(js,/eq\('space_id',SP\)/);
  assert.match(js,/onConflict:'space_id,weekday,manipulation_code'/);
  assert.match(js,/onConflict:'space_id,code'/);
});
