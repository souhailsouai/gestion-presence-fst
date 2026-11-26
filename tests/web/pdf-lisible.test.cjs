'use strict';
// PDF lisibles : tableaux jamais sous 8,5 pt, traits visibles à l'impression.
const test=require('node:test');const assert=require('node:assert/strict');const path=require('node:path');
const {readableTable,MIN_TABLE}=require(path.join(__dirname,'..','..','web','v49-pdf-lisible.js'));
test('Les petites polices des tableaux sont relevées à 8,5 pt',()=>{
  const o=readableTable({styles:{fontSize:7,cellPadding:1.6},headStyles:{fontSize:7.2},columnStyles:{0:{fontSize:6}}});
  assert.equal(o.styles.fontSize,MIN_TABLE);assert.equal(o.headStyles.fontSize,MIN_TABLE);assert.equal(o.columnStyles[0].fontSize,MIN_TABLE);
  assert.equal(o.styles.overflow,'linebreak','le texte passe à la ligne au lieu de déborder');
});
test('Les tailles déjà lisibles et les autres réglages restent inchangés',()=>{
  const o=readableTable({styles:{fontSize:10,overflow:'ellipsize',cellPadding:2},headStyles:{fillColor:[11,122,156],textColor:255}});
  assert.equal(o.styles.fontSize,10);assert.equal(o.styles.overflow,'ellipsize');assert.equal(o.styles.cellPadding,2);
  assert.deepEqual(o.headStyles.fillColor,[11,122,156]);assert.equal(o.headStyles.textColor,255);
});
test('Les traits trop fins ou trop pâles deviennent visibles',()=>{
  const o=readableTable({styles:{lineWidth:.1,lineColor:200}});
  assert.equal(o.styles.lineWidth,0.2);assert.equal(o.styles.lineColor,150);
  assert.equal(readableTable({styles:{lineWidth:0}}).styles.lineWidth,0,'sans trait reste sans trait');
});
test('Le texte gris moyen est foncé ; le blanc et les couleurs restent',()=>{
  assert.equal(readableTable({styles:{textColor:80}}).styles.textColor,40);
  assert.equal(readableTable({headStyles:{textColor:255}}).headStyles.textColor,255);
  assert.deepEqual(readableTable({styles:{textColor:[190,0,0]}}).styles.textColor,[190,0,0]);
});
