const fs = require('node:fs');
const assert = require('node:assert/strict');
const src = fs.readFileSync('web/reports.js', 'utf8');
assert.match(src, /FSTApp\.reports\s*=\s*FSTApp\.reports\s*\|\|/);
for (const fn of ['buildAttendanceSummary','buildGradeSummary','exportAttendancePdf','exportStatisticsPdf']) {
  assert.match(src, new RegExp(`reports\\.${fn}\\s*=`));
}
for (const label of ['Lecture seule','Statistiques et graphiques','Répartition des notes','Comparaison par module']) assert.match(src, new RegExp(label));
assert.match(src, /Moteur PDF indisponible/);
console.log('PASS: reports and statistics parity contract');
