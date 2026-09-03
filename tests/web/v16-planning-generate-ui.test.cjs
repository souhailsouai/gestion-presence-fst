const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync('web/v16-planning-ui.js','utf8');

test('planning UI exposes Generate menu with PDF and Excel options',()=>{
  assert.match(source,/Générer/);
  assert.match(source,/PDF/);
  assert.match(source,/Excel \(\.xlsx\)/);
  assert.match(source,/data-v16-generate-pdf/);
  assert.match(source,/data-v16-generate-xlsx/);
});

test('exports consume current in-memory filtered rows and active filters',()=>{
  assert.match(source,/lastFiltered/);
  assert.match(source,/buildPlanningExportModel/);
  assert.match(source,/readFilters\(\)/);
  assert.match(source,/V16PlanningPdf|planningPdfApi/);
  assert.match(source,/V16PlanningXlsx|planningXlsxApi/);
});

test('generate controls expose loading and success error feedback',()=>{
  assert.match(source,/data-v16-generate-status/);
  assert.match(source,/disabled\s*=\s*true/);
  assert.match(source,/disabled\s*=\s*false/);
  assert.match(source,/Génération en cours/);
  assert.match(source,/généré|générée/i);
  assert.match(source,/Erreur|impossible/i);
});
