const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path='web/v16-planning-pdf.js';
const source=fs.existsSync(path)?fs.readFileSync(path,'utf8'):'';
let api=null;
try{api=require('../../web/v16-planning-pdf.js');}catch(_){api=null;}
const model={title:'Planning des séances — FST',subtitle:'MPI1-A · G2',academicYear:'2026/2027',semester:'Semestre 1',generatedAt:'03/09/2026 20:00',context:'real',columns:['Semaine','Date','Jour','Horaire','Classe','Groupe','Manipulation','Salle','Enseignant'],rows:[{Semaine:'2026-W38',Date:'14/09/2026',Jour:'Lundi',Horaire:'13:45–17:30',Classe:'MPI1-A',Groupe:'G2',Manipulation:'M2',Salle:'Salle B',Enseignant:'Olfa',État:'Affectée'}]};

test('V16 planning PDF module exists with generate API',()=>{assert.ok(source.length>0);assert.ok(api);assert.equal(typeof api.generate,'function');assert.equal(typeof api.buildPdfSpec,'function');});
test('PDF spec contains institutional metadata and exact filtered rows',()=>{const spec=api.buildPdfSpec(model);assert.match(spec.header.join(' '),/Faculté des Sciences de Tunis|FST/);assert.match(spec.header.join(' '),/2026\/2027/);assert.match(spec.header.join(' '),/Semestre 1/);assert.match(spec.header.join(' '),/MPI1-A · G2/);assert.equal(spec.body.length,1);assert.deepEqual(spec.head[0],model.columns);});
test('REAL PDF spec excludes TEST-only labels and internal table names',()=>{const text=JSON.stringify(api.buildPdfSpec(model));assert.doesNotMatch(text,/MODE TEST|v16_test_|TEST uniquement/i);});
test('generator uses existing jsPDF AutoTable pagination and repeated header path',()=>{assert.match(source,/window\.jspdf|root\.jspdf/);assert.match(source,/autoTable/);assert.match(source,/showHead\s*:\s*['"]everyPage['"]/);assert.match(source,/doc\.save|AndroidPdfBridge/);});
