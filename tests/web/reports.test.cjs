const fs = require('node:fs');
const assert = require('node:assert/strict');
const src = fs.readFileSync('web/reports.js', 'utf8');
for (const fn of ['buildAttendanceSummary','buildGradeSummary','exportAttendancePdf','exportStatisticsPdf']) {
  assert.match(src, new RegExp(`FSTApp\\.reports\\.${fn}`));
}
for (const label of ['Lecture seule','Statistiques et graphiques','Répartition des notes','Comparaison par module']) assert.match(src, new RegExp(label));
assert.match(src, /Moteur PDF indisponible/);
console.log('PASS: reports and statistics parity contract');
