const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');
const canonicalPath = path.join(root, 'gestion_presence_tp_theme_institutionnel.html');

test('canonical approved web interface exists', () => {
  assert.equal(fs.existsSync(canonicalPath), true);
  const html = fs.readFileSync(canonicalPath, 'utf8');
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
