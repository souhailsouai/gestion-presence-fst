'use strict';
// PDF du planning S2 : une page par jour partagé (les classes qui alternent sont sur la même feuille).
const test=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const WEB=path.join(__dirname,'..','..','web');
const C=require(path.join(WEB,'v33-s2-core.js'));

function data(mode){
  const settings={academic_year:'2026/2027',start_date:'2027-01-11',end_date:'2027-04-30',group_count:5,manip_count:5};
  const mk=(c,w,k,o,m)=>({class_name:c,weekday:w,start_time:'14:00:00',end_time:'17:00:00',pair_key:k,pair_order:o,mode:m,active:true});
  const slots=[mk('MPI1-A',1,'lundi',1,'alternance'),mk('MPI1-E',1,'lundi',2,'alternance'),mk('MPI1-C',4,'jeudi',1,'alternance'),mk('MPI1-D',4,'jeudi',2,'alternance'),mk('MPI1-B',5,'vendredi',1,mode),mk('PC1-A',5,'vendredi',2,mode)];
  const excluded=[{starts_on:'2027-02-22',ends_on:'2027-02-28',label:'DS',kind:'ds',validated:true},{starts_on:'2027-04-09',ends_on:'2027-04-09',label:'عيد الشهداء',kind:'ferie',validated:true}];
  const stations=[1,4,5].flatMap(w=>['M1','M2','M3','M4','M5'].map(m=>({weekday:w,manipulation_code:m,teacher_id:null,room:'A'})));
  const {sessions}=C.generatePlan({settings,classSlots:slots,stations,manipulations:['M1','M2','M3','M4','M5'].map(code=>({code,active:true})),excluded,kept:[]});
  sessions.forEach((s,i)=>{s.id='s'+i;s.slots.forEach((g,j)=>{g.id=`g${i}_${j}`;});});
  return {settings,slots,excluded,sessions};
}
function load(){
  const jspdf=require(path.join(WEB,'vendor','jspdf.umd.min.js'));
  const out=[];
  jspdf.jsPDF.API.save=function(name){out.push({name,pages:this.getNumberOfPages(),text:Buffer.from(this.output('arraybuffer')).toString('latin1')});};
  const ctx={jspdf,console,setTimeout,localStorage:{getItem(){},setItem(){}},addEventListener(){},dispatchEvent(){},CustomEvent:function(){},setInterval(){},clearInterval(){},
    document:{readyState:'loading',querySelectorAll:()=>[],addEventListener(){},getElementById(){return null;},body:{dataset:{}}}};
  ctx.window=ctx;vm.createContext(ctx);
  for(const f of ['v33-s2-core.js','v33-semestres.js'])vm.runInContext(fs.readFileSync(path.join(WEB,f),'utf8'),ctx,{filename:f});
  return {api:ctx.V33Semestres,out};
}
const ALL=['MPI1-A','MPI1-B','MPI1-C','MPI1-D','MPI1-E','PC1-A'];

test('PDF S2 : 3 pages pour 6 classes (une par jour partagé)',async()=>{
  const {api,out}=load();await api.exportPdf(ALL,data('alternance'));
  assert.equal(out.length,1);assert.equal(out[0].pages,3);
});
test('PDF S2 : une classe exporte la feuille de sa paire',async()=>{
  const {api,out}=load();await api.exportPdf(['PC1-A'],data('bloc'));
  assert.equal(out[0].name,'Planning_MPI1-B_PC1-A_TP_Physique_S2.pdf');assert.equal(out[0].pages,1);
});
test('Partage « comme au S1 » : toutes les séances de MPI1-B avant celles de PC1-A',()=>{
  const fri=data('bloc').sessions.filter(s=>['MPI1-B','PC1-A'].includes(s.class_name));
  const lastB=fri.filter(s=>s.class_name==='MPI1-B').pop().session_date,firstP=fri.find(s=>s.class_name==='PC1-A').session_date;
  assert.ok(lastB<firstP);
  const alt=data('alternance').sessions.filter(s=>['MPI1-B','PC1-A'].includes(s.class_name)).map(s=>s.class_name);
  assert.deepEqual(alt.slice(0,4),['MPI1-B','PC1-A','MPI1-B','PC1-A']);
});
