const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const online=fs.readFileSync('scripts/build_online_web.py','utf8');
const standalone=fs.readFileSync('scripts/build_single_file_release.py','utf8');

test('online builder loads one SheetJS engine and all V16 planning export modules',()=>{
  assert.match(online,/xlsx\.full\.min\.js/);
  assert.match(online,/SheetJS|sheetjs/i);
  for(const file of ['v16-planning-export-model.js','v16-planning-pdf.js','v16-planning-xlsx.js'])assert.match(online,new RegExp(file.replaceAll('.','\\.')),file);
});

test('standalone builder inlines one XLSX engine and all export modules',()=>{
  assert.match(standalone,/xlsx\.full\.min\.js/);
  assert.match(standalone,/data-fst-xlsx-engine="inline"/);
  assert.match(standalone,/xlsx_engine/);
  for(const marker of ['v16-planning-export-model.js','v16-planning-pdf.js','v16-planning-xlsx.js','data-fst-v16-planning-export-model="inline"','data-fst-v16-planning-pdf="inline"','data-fst-v16-planning-xlsx="inline"'])assert.match(standalone,new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),marker);
});

test('builders do not introduce a second spreadsheet library',()=>{
  const text=online+'\n'+standalone;
  assert.doesNotMatch(text,/exceljs|handsontable|jspreadsheet/i);
});
