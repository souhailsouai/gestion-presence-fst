const test=require('node:test');
const assert=require('node:assert/strict');

test('pinned jsPDF and AutoTable create PDF bytes',()=>{
  const {jsPDF}=require('../../web/vendor/jspdf.umd.min.js');
  const auto=require('../../web/vendor/jspdf.plugin.autotable.min.js');
  auto.applyPlugin(jsPDF);
  const doc=new jsPDF();
  doc.text('FST',10,10);
  doc.autoTable({head:[['A','B']],body:[['1','2']]});
  const bytes=doc.output('arraybuffer');
  assert.ok(bytes.byteLength>1000);
});
