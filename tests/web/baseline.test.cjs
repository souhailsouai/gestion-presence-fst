const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const htmlPath = path.join(__dirname, '..', '..', 'web', 'index.html');

test('canonical approved web interface exists', () => {
  assert.equal(fs.existsSync(htmlPath), true);
  const html = fs.readFileSync(htmlPath, 'utf8');
  for (const marker of [
    'Gestion Présence FST — 2026/2027',
    'teacher_directory',
    'admin-teacher',
    'restorePersistentSession',
    'ACTIVE_MODE_KEY',
    'loginTeacher',
    "const ACADEMIC_YEAR = '2026/2027'"
  ]) assert.match(html, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
