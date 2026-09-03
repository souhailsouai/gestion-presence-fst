const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path='web/v16-planning-xlsx.js';
const source=fs.existsSync(path)?fs.readFileSync(path,'utf8'):'';
let api=null;
try{api=require('../../web/v16-planning-xlsx.js');}catch(_){api=null;}
const model={title:'Planning des séances — FST',subtitle:'MPI1-A · G2',academicYear:'2026/2027',semester:'Semestre 1',generatedAt:'03/09/2026 20:00',context:'real',columns:['Semaine','Date','Jour','Horaire','Classe','Groupe','Manipulation','Salle','Enseignant'],rows:[{Semaine:'2026-W38',Date:'14/09/2026',Jour:'Lundi',Horaire:'13:45–17:30',Classe:'MPI1-A',Groupe:'G2',Manipulation:'M2',Salle:'Salle B',Enseignant:'Olfa'}]};

test('V16 planning XLSX module exposes generator and workbook spec',()=>{assert.ok(source.length>0,'xlsx module missing');assert.ok(api);assert.equal(typeof api.generate,'function');assert.equal(typeof api.buildWorkbookSpec,'function');});
test('workbook spec contains institutional metadata, headers and exact filtered rows',()=>{const spec=api.buildWorkbookSpec(model);assert.equal(spec.sheetName,'Planning TP');assert.match(spec.rows[0][0],/Faculté des Sciences de Tunis|FST/);assert.ok(spec.rows.some(r=>r.includes('2026/2027')));const headerIndex=spec.rows.findIndex(r=>r[0]==='Semaine');assert.ok(headerIndex>=0);assert.deepEqual(spec.rows[headerIndex],model.columns);assert.equal(spec.rows.length-headerIndex-1,1);assert.equal(spec.rows[headerIndex+1][1],'14/09/2026');assert.equal(spec.rows[headerIndex+1][3],'13:45–17:30');});
test('REAL workbook spec excludes TEST-only labels',()=>{assert.doesNotMatch(JSON.stringify(api.buildWorkbookSpec(model)),/MODE TEST|v16_test_|TEST uniquement/i);});
test('generator uses one SheetJS XLSX dependency and writes xlsx',()=>{assert.match(source,/XLSX/);assert.match(source,/aoa_to_sheet/);assert.match(source,/book_new/);assert.match(source,/book_append_sheet/);assert.match(source,/writeFile/);assert.match(source,/\.xlsx/);});
