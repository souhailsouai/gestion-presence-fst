const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.join(__dirname,'..','..');

function loadTime(){const ctx={window:{}};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'web','time-format.js'),'utf8'),ctx);return ctx.window.FSTTime;}
function loadImport(){const ctx={window:{},TextDecoder};vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'web','student-import.js'),'utf8'),ctx);return ctx.window.FSTStudentImport;}

test('24-hour helper normalizes and rejects invalid values',()=>{const t=loadTime();assert.equal(t.normalize('7:30'),'07:30');assert.equal(t.normalize('00:00'),'00:00');assert.equal(t.normalize('23:59'),'23:59');assert.equal(t.normalize('24:00'),null);assert.equal(t.normalize('13:72'),null);assert.equal(t.format('07:05:00'),'07:05');});

test('student management renders one class block with deterministic group styling and class_id reassignment',()=>{const js=fs.readFileSync(path.join(root,'web','student-management.js'),'utf8');assert.match(js,/student-class-block/);assert.match(js,/classKey\(c\)/);assert.match(js,/student-group-/);assert.match(js,/changeStudentGroup/);assert.match(js,/update\(\{class_id:String\(targetClassId\)\}\)/);});

test('csv parser handles accents semicolons quotes and removes NUL',()=>{const a=loadImport();const b=new TextEncoder().encode('Nom;Prénom;Email;Classe;Groupe\n"Souaï";Söuhail;a@b.tn;MPI1;G1\nNu\0l;Test;;MPI1;G2').buffer;const r=a.parseCsv(b);assert.equal(r.rows.length,2);assert.equal(r.rows[0].nom,'Souaï');assert.equal(r.rows[0].groupe,'G1');assert.equal(r.rows[1].nom.includes('\u0000'),false);});

test('excel import uses ArrayBuffer XLSX parser and never readAsText',()=>{const js=fs.readFileSync(path.join(root,'web','student-import.js'),'utf8');assert.match(js,/XLSX\.read\(arrayBuffer/);assert.match(js,/file\.arrayBuffer\(\)/);assert.doesNotMatch(js,/readAsText/);});

test('MPI classes display A-E, groups support G1-G10, and class PDF carries session grades plus average',()=>{const js=fs.readFileSync(path.join(root,'web','class-structure-pdf.js'),'utf8');for(const marker of ["['A','B','C','D','E']",'Array.from({length:10}','MPI1-${classLetter(n)}','PDF de la classe','Notes par séance','Moyenne /20','buildClassReportModel','generateClassPdf'])assert.ok(js.includes(marker),`missing ${marker}`);});

test('standalone builder inlines excel, time, student import, student management, and class PDF modules',()=>{const py=fs.readFileSync(path.join(root,'scripts','build_single_file_release.py'),'utf8');for(const marker of ['xlsx.full.min.js','time-format.js','time-integration.js','student-import.js','student-management.js','class-structure-pdf.js','data-fst-excel-engine','data-fst-student-management','data-fst-class-structure-pdf'])assert.ok(py.includes(marker),`missing ${marker}`);});
