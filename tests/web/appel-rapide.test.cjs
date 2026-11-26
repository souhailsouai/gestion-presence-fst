'use strict';
// Écran d'appel « liste rapide » (V50) : compteur, filtres, changements non enregistrés.
const test=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');const fs=require('node:fs');
const A=require(path.join(__dirname,'..','..','web','v50-appel.js'));
test('Le compteur compte chaque statut et le total',()=>{
  assert.deepEqual(A.counts(['present','absent','present','retard','justifie']),{present:2,absent:1,retard:1,justifie:1,total:5});
  assert.deepEqual(A.counts([]),{present:0,absent:0,retard:0,justifie:0,total:0});
});
test('Filtres et recherche (sans accents ni majuscules)',()=>{
  const r={name:'GHARBI Inès',status:'retard',gradeEmpty:true};
  assert.equal(A.visible(r,'all',''),true);assert.equal(A.visible(r,'retard',''),true);assert.equal(A.visible(r,'absent',''),false);
  assert.equal(A.visible(r,'all','ines'),true);assert.equal(A.visible(r,'all','khelifi'),false);
  assert.equal(A.visible(r,'nograde',''),true,'retard sans note');
  assert.equal(A.visible({...r,status:'absent'},'nograde',''),false,'un absent n’est jamais « sans note »');
  assert.equal(A.visible({...r,gradeEmpty:false},'nograde',''),false);
});
test('Un changement annulé ne compte plus ; note ou commentaire comptent',()=>{
  const orig=new Map([['a','present'],['b','present']]);
  assert.equal(A.changedCount(new Map([['a','absent'],['b','present']]),orig,[]),1);
  assert.equal(A.changedCount(new Map([['a','present'],['b','present']]),orig,[]),0,'retour au statut enregistré');
  assert.equal(A.changedCount(new Map([['a','absent'],['b','present']]),orig,['a','b']),2);
});
test('La barre dit clairement si l’appel est enregistré',()=>{
  assert.equal(A.barText(2,false,false).title,'Non enregistré');assert.equal(A.barText(1,false,false).sub,'1 changement');
  assert.equal(A.barText(0,true,false).state,'saved');
  assert.equal(A.barText(0,false,true).state,'dirty','jamais enregistré : ne pas laisser croire que c’est fait');
  assert.equal(A.barText(0,false,false).state,'idle');
});
test('Le module est chargé par la page et ne remplace pas la logique d’enregistrement',()=>{
  const html=fs.readFileSync(path.join(__dirname,'..','..','web','index.html'),'utf8');
  assert.ok(html.includes('v50-appel.js'));
  const src=fs.readFileSync(path.join(__dirname,'..','..','web','v50-appel.js'),'utf8');
  assert.ok(!/window\.saveAttendance\s*=|root\.saveAttendance\s*=/.test(src),'saveAttendance n’est jamais réécrit');
  assert.ok(src.includes("dispatchEvent(new Event('change'"),'le select d’origine reste la source de vérité');
});
