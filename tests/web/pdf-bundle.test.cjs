const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('final HTML bundles PDF engine without runtime CDN dependencies',()=>{
  const html=fs.readFileSync('web/index.html','utf8');
  assert.match(html,/jsPDF - PDF Document creation from JavaScript|jspdf/i);
  assert.match(html,/autoTable/);
  assert.doesNotMatch(html,/<script[^>]+src=["'][^"']*(?:jspdf|html2canvas)[^"']*["']/i);
  assert.match(html,/data-fst-pdf-engine="inline"/);
});
