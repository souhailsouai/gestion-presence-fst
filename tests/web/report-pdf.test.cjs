const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('report PDF module exposes session and general PDF APIs with access checks',()=>{
  const p='web/report-pdf.js';
  assert.equal(fs.existsSync(p),true);
  const js=fs.readFileSync(p,'utf8');
  assert.match(js,/buildSessionReportModel/);
  assert.match(js,/generateSessionPdf/);
  assert.match(js,/buildGeneralReportModel/);
  assert.match(js,/generateGeneralPdf/);
  assert.match(js,/canManageRecord/);
  assert.match(js,/autoTable/);
  assert.match(js,/2026\/2027/);
});

test('report PDF module uses Android bridge when hosted in the APK',()=>{
  const js=fs.readFileSync('web/report-pdf.js','utf8');
  assert.match(js,/AndroidPdfBridge/);
  assert.match(js,/datauristring/);
  assert.match(js,/savePdf/);
});
