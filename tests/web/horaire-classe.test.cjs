'use strict';
// V53 : changer l'horaire d'une classe le change partout (séances à venir, appel, PDF).
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const root=path.join(__dirname,'..','..');
test('Serveur : déclencheur sur le créneau de la classe, séances à venir seulement',()=>{
  const sql=fs.readFileSync(path.join(root,'supabase','migrations','20261127090000_v53_horaire_classe_partout.sql'),'utf8');
  assert.match(sql,/after update of start_time, end_time on public\.v33_s2_class_slots/);
  assert.match(sql,/session_date >= v_today/,'jamais les séances passées');
  assert.match(sql,/start_time = old\.start_time and s\.end_time = old\.end_time/,'une séance réglée autrement est gardée');
  assert.match(sql,/update public\.sessions x/,'les séances d’appel déjà ouvertes suivent aussi');
});
test('Site : heure libre (champ horloge), contrôle, mise à jour immédiate de l’écran',()=>{
  const ui=fs.readFileSync(path.join(root,'web','v33-semestres.js'),'utf8');
  assert.ok(ui.includes('<input type="time" name="st"')&&ui.includes('<input type="time" name="et"'));
  assert.ok(ui.includes('nouvel horaire appliqué aux séances à venir'));
  assert.ok(ui.includes("Indiquez l’heure de début et de fin de chaque classe"));
});
test('Application : champ d’heure avec horloge, 13.30 / 13h30 / 1330 acceptés',()=>{
  const kt=fs.readFileSync(path.join(root,'app-native','src','main','java','tn','utm','fst','gestionpresence','nativeapp','ui','TimeField.kt'),'utf8');
  assert.ok(kt.includes('TimePicker(')&&kt.includes('fun normalizeTime'));
  const s2=fs.readFileSync(path.join(root,'app-native','src','main','java','tn','utm','fst','gestionpresence','nativeapp','ui','S2AdminScreen.kt'),'utf8');
  assert.ok(s2.includes('TimeField("Début", c.start'));
});
