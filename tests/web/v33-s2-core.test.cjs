const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../../web/v33-s2-core.js');

const settings={start_date:'2027-01-11',end_date:'2027-06-30',group_count:6,manip_count:6};
const manipulations=['M1','M2','M3','M4','M5','M6'].map((code,i)=>({code,room:'ABCDEF'[i]}));
const stations=[1,4,5].flatMap(w=>manipulations.map((m,i)=>({weekday:w,manipulation_code:m.code,teacher_id:`t${w}${i+1}`})));
const classSlots=[
  {class_name:'MPI1-A',weekday:1,start_time:'14:00',end_time:'17:00',pair_key:'lundi',pair_order:1,mode:'alternance'},
  {class_name:'MPI1-E',weekday:1,start_time:'14:00',end_time:'17:00',pair_key:'lundi',pair_order:2,mode:'alternance'},
  {class_name:'MPI1-B',weekday:5,start_time:'14:00',end_time:'17:00',pair_key:'vendredi',pair_order:1,mode:'bloc'},
  {class_name:'PC1-A',weekday:5,start_time:'14:00',end_time:'17:00',pair_key:'vendredi',pair_order:2,mode:'bloc'},
];

test('rotation identique au S1 (G1 M1 au 1er passage, décalage de 1 ensuite)',()=>{
  assert.equal(C.manipulationFor(1,1,6),'M1');
  assert.equal(C.manipulationFor(6,1,6),'M6');
  assert.equal(C.manipulationFor(1,2,6),'M2');
  assert.equal(C.manipulationFor(6,2,6),'M1');
});

test('aucune séance avant le 11/01/2027, même si la date de début demandée est plus tôt',()=>{
  const {sessions}=C.generatePlan({settings:Object.assign({},settings,{start_date:'2026-12-01'}),classSlots,stations,manipulations});
  assert.ok(sessions.length>0);
  assert.ok(sessions.every(s=>s.session_date>='2027-01-11'));
});

test('chaque groupe fait chaque manipulation une seule fois, enseignant du poste',()=>{
  const plan=C.generatePlan({settings,classSlots,stations,manipulations});
  assert.deepEqual(plan.warnings,[]);
  for(const cls of ['MPI1-A','MPI1-E','MPI1-B','PC1-A'])assert.equal(plan.sessions.filter(s=>s.class_name===cls).length,6);
  const issues=C.checkPlan({settings,sessions:plan.sessions}).filter(i=>i.level!=='info');
  assert.deepEqual(issues,[]);
  const a1=plan.sessions.find(s=>s.class_name==='MPI1-A');
  assert.equal(a1.session_date,'2027-01-11');
  assert.equal(a1.slots[0].teacher_id,'t11');
});

test('alternance le lundi, bloc le vendredi',()=>{
  const {sessions}=C.generatePlan({settings,classSlots,stations,manipulations});
  const mon=sessions.filter(s=>C.weekdayOf(s.session_date)===1).map(s=>s.class_name);
  assert.deepEqual(mon.slice(0,4),['MPI1-A','MPI1-E','MPI1-A','MPI1-E']);
  const fri=sessions.filter(s=>C.weekdayOf(s.session_date)===5).map(s=>s.class_name);
  assert.deepEqual(fri,['MPI1-B','MPI1-B','MPI1-B','MPI1-B','MPI1-B','MPI1-B','PC1-A','PC1-A','PC1-A','PC1-A','PC1-A','PC1-A']);
});

test('seules les dates exclues VALIDÉES sont sautées',()=>{
  const excluded=[{starts_on:'2027-01-11',ends_on:'2027-01-11',label:'Férié',validated:true},{starts_on:'2027-01-18',ends_on:'2027-01-18',label:'Proposé',validated:false}];
  const {sessions}=C.generatePlan({settings,classSlots,stations,manipulations,excluded});
  const mon=sessions.filter(s=>C.weekdayOf(s.session_date)===1);
  assert.equal(mon[0].session_date,'2027-01-18');
  assert.ok(!sessions.some(s=>s.session_date==='2027-01-11'));
});

test('recalcul ciblé : les séances conservées comptent dans la rotation',()=>{
  const full=C.generatePlan({settings,classSlots,stations,manipulations}).sessions;
  const kept=full.filter(s=>s.session_date<'2027-02-01');
  const re=C.generatePlan({settings,classSlots,stations,manipulations,kept,fromDate:'2027-02-01'}).sessions;
  const all=kept.concat(re);
  for(const cls of ['MPI1-A','MPI1-E','MPI1-B','PC1-A'])assert.equal(all.filter(s=>s.class_name===cls).length,6);
  assert.deepEqual(C.checkPlan({settings,sessions:all}).filter(i=>i.level==='erreur'),[]);
});

test('équilibrage : seuls les actifs non verrouillés bougent',()=>{
  const m=[];
  for(let i=0;i<9;i++)m.push({student_id:'a'+i,name:'A'+i,class_name:'X',group_no:1,status:'actif',locked:i===0});
  m.push({student_id:'b',name:'B',class_name:'X',group_no:2,status:'actif'});
  m.push({student_id:'z',name:'Z',class_name:'X',group_no:1,status:'exclu'});
  const {members,moves}=C.balanceGroups(m,3);
  const size=g=>members.filter(x=>x.status==='actif'&&x.group_no===g).length;
  assert.ok(Math.max(size(1),size(2),size(3))-Math.min(size(1),size(2),size(3))<=1);
  assert.equal(members.find(x=>x.student_id==='a0').group_no,1);
  assert.equal(members.find(x=>x.student_id==='z').group_no,1);
  assert.ok(moves.length>0);
});

test('postes S1 retrouvés à partir des séances réelles',()=>{
  const rows=[];
  ['2026-09-14','2026-09-28'].forEach((d,idx)=>{for(let g=1;g<=6;g++)rows.push({class_name:'MPI1-A-G'+g,session_date:d,teacher_id:'T'+(((g-1+idx)%6)+1)});});
  const st=C.stationsFromS1(rows);
  assert.equal(st.length,6);
  assert.deepEqual(st.map(s=>s.teacher_id),['T1','T2','T3','T4','T5','T6']);
});

test('statistiques de présence par classe',()=>{
  const r=C.attendanceStats([{class_name:'A',group:'A-G1',student:'x',status:'present',date:'2026-10-01'},{class_name:'A',group:'A-G1',student:'y',status:'absent',date:'2026-10-01'}]);
  assert.equal(r.byClass[0].rate,50);
});
