'use strict';
// Parité site ↔ application : chaque fonction du site doit exister dans l'application Android.
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const ROOT=path.join(__dirname,'..','..');
function readAll(dir,ext,out=[]){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())readAll(p,ext,out);else if(p.endsWith(ext))out.push(fs.readFileSync(p,'utf8'));}return out;}
const site=fs.readdirSync(path.join(ROOT,'web')).filter(f=>f.endsWith('.js')).map(f=>fs.readFileSync(path.join(ROOT,'web',f),'utf8')).join('\n')+fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const app=readAll(path.join(ROOT,'app-native','src','main','java'),'.kt').join('\n');
const FEATURES=[
  ['Bilan S1 (absences en couleur)','Bilan S1 (absences en couleur)'],
  ['Cahier','Tous les cahiers'],
  ['Comme au S1','Comme au S1'],
  ['Reprendre ceux du S1','Reprendre ceux du S1'],
  ['Modifier les avis','Avis officiels (modifier)'],
  ['Manipulations enregistrées','Enregistrer les manipulations'],
  ['Équilibrer','Équilibrer'],
  ['Réintégrer','Réintégrer'],
  ['Restaurer','Restaurer'],
  ['Rattrapé','Rattrapé'],
  ['v16_end_student_membership','v16_end_student_membership'],
  ['change-pin','change-pin'],
  ['generateStatisticsPdf','StatsPdf'],
  ['v37_s2_auto_replan','v37_s2_auto_replan'],
  ['Intervenants par jour','Intervenants par jour'],
  ['v44_s2_start_slot','v44_s2_start_slot'],
  ['Autres espaces','Autres espaces'],
  ['Mes espaces seulement','Mes espaces seulement'],
  ['v45_am_super_admin','v45_am_super_admin'],
  ['Afficher le S1 (archives)','Afficher le S1 (archives)'],
  ['Rôles et accès','Rôles et accès'],
  ['MAINTENANT','MAINTENANT'],
  ['Saisir les notes','Saisir les notes'],
  ['À rattraper','À rattraper'],
  ['Bilan S2','Bilan S2'],
  ["LISTE DES GROUPES D'ÉTUDIANTS","LISTE DES GROUPES D'ÉTUDIANTS"],
  ['Créer un compte enseignant','Créer un compte enseignant'],
  ['Nouveau PIN','Nouveau PIN'],
  ['set_teacher_pin','set_teacher_pin'],
  ['v47_set_permissions','v47_set_permissions'],
  ['Gestionnaire du planning','Gestionnaire du planning'],
  ['space_permissions','space_permissions'],
  ["Équipe de l'espace",'Équipe de l’espace'],
  ['S1 : celui des séances S1 suivies','S1 : celui des séances S1 suivies'],
  ['Intervenants du','Intervenants du'],
  ['v43_create_space','v43_create_space'],
  ['v43_set_member','v43_set_member'],
  ['Classes & étudiants','Classes & étudiants'],
  ['p_space','p_space'],
];
for(const [s,a] of FEATURES){
  test(`parité : « ${s} » existe sur le site et dans l'application`,()=>{
    assert.ok(site.includes(s),`site : ${s}`);
    assert.ok(app.includes(a),`application : ${a}`);
  });
}
