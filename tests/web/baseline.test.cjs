const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');
const canonicalPath = path.join(root, 'gestion_presence_tp_theme_institutionnel.html');

test('canonical approved web interface exists', () => {
  assert.equal(fs.existsSync(canonicalPath), true);
  const html = fs.readFileSync(canonicalPath, 'utf8');

  // This test protects the approved source interface only. Runtime security,
  // RPC and release markers are injected by the build and are verified by
  // build-web.test.cjs plus the release workflow.
  for (const marker of [
    '<!DOCTYPE html>',
    '<html lang="fr">',
    '<title>Gestion de Présence Étudiants</title>',
    'id="login-role"',
    'async function loginTeacher()',
    "const ACADEMIC_YEAR = '2026/2027'",
    "const PREPARATORY_TRACKS = ['MPI','PC']",
    'window.supabase.createClient'
  ]) {
    assert.ok(html.includes(marker), `Missing canonical marker: ${marker}`);
  }
});
