'use strict';
// V52 : nombre de groupes (= manipulations) réglable par classe : 4, 5 ou 6.
const test=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');const fs=require('node:fs');
const C=require(path.join(__dirname,'..','..','web','v33-s2-core.js'));
const settings={start_date:'2027-01-11',end_date:'2027-06-30',group_count:5,manip_count:5};
const slot=(name,extra)=>Object.assign({class_name:name,weekday:1,start_time:'08:30:00',end_time:'11:30:00',pair_key:name,pair_order:1,mode:'alternance',active:true},extra);
test('Une classe à 6, une à 4, une sans réglage (5) : séances, groupes et rotation complète',()=>{
  const classSlots=[slot('A',{group_count:6}),slot('B',{group_count:4,weekday:2}),slot('C',{weekday:3})];
  const {sessions,warnings}=C.generatePlan({settings,classSlots,stations:[],manipulations:[],excluded:[],kept:[]});
  assert.deepEqual(warnings,[]);
  for(const [cls,n] of [['A',6],['B',4],['C',5]]){
    const list=sessions.filter(s=>s.class_name===cls);
    assert.equal(list.length,n,`${cls} : ${n} séances`);
    for(const s of list)assert.equal(s.slots.length,n,`${cls} : ${n} groupes`);
    for(let g=1;g<=n;g++){
      const seen=list.map(s=>s.slots.find(x=>x.group_no===g).manipulation_code).sort();
      assert.deepEqual(seen,Array.from({length:n},(_,i)=>'M'+(i+1)).sort(),`${cls} G${g} fait chaque manipulation une fois`);
    }
  }
  assert.deepEqual(C.checkPlan({settings,classSlots,excluded:[],sessions}).filter(i=>i.level==='erreur'||/manque/.test(i.text)),[]);
});
test('Sans réglage par classe, rien ne change (valeurs de l’espace)',()=>{
  assert.deepEqual(C.classCounts('X',settings,[slot('X')]),{group_count:5,manip_count:5});
  assert.deepEqual(C.classCounts('X',{group_count:5,manip_count:4},[]),{group_count:5,manip_count:4});
  assert.deepEqual(C.classCounts('X',settings,[slot('X',{group_count:6})]),{group_count:6,manip_count:6});
});
test('Passer une classe de 5 à 4 groupes : les étudiants du G5 rejoignent les plus petits groupes',()=>{
  const m=(id,g,locked=false)=>({student_id:id,name:id,class_name:'A',group_no:g,status:'actif',locked});
  const members=[m('a',1),m('b',1),m('c',2),m('d',3),m('e',4),m('f',5),m('g',5,true)];
  const {members:out,moves}=C.balanceGroups(members,()=>4);
  assert.ok(out.every(x=>x.group_no>=1&&x.group_no<=4),'plus personne dans le G5');
  assert.ok(moves.some(x=>x.student_id==='g'),'même un étudiant verrouillé quitte un groupe supprimé');
  const sizes=[1,2,3,4].map(g=>out.filter(x=>x.group_no===g).length);
  assert.ok(Math.max(...sizes)-Math.min(...sizes)<=1,'groupes équilibrés');
  assert.equal(C.balanceGroups(members.slice(0,6).map(x=>x.group_no===5?{...x,group_no:4}:x),5).moves.length>=0,true,'un nombre reste accepté');
});
test('Paramètres : choix 4 / 5 / 6 par classe et migration serveur',()=>{
  const ui=fs.readFileSync(path.join(__dirname,'..','..','web','v33-semestres.js'),'utf8');
  assert.ok(ui.includes('name="gc"')&&ui.includes('[4,5,6]'));
  const sql=fs.readFileSync(path.join(__dirname,'..','..','supabase','migrations','20261126130000_v52_groupes_par_classe.sql'),'utf8');
  assert.ok(/group_count between 4 and 6/.test(sql));
});
