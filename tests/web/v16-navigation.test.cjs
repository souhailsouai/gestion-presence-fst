const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..', '..');
const html = fs.readFileSync(path.join(root, 'gestion_presence_tp_theme_institutionnel.html'), 'utf8');

function navEntries(source) {
  const navMatch = source.match(/<!-- Navigation -->([\s\S]*?)<!-- Contenu -->/i);
  assert.ok(navMatch, 'Navigation block not found');
  return [...navMatch[1].matchAll(/<button[^>]*class="nav-tab[^\"]*"[^>]*onclick="switchTab\('([^']+)'\)"[^>]*>([\s\S]*?)<\/button>/gi)]
    .map(([, id, body]) => ({
      id,
      text: body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    }));
}

test('V16 navigation follows the approved native order', () => {
  const entries = navEntries(html);
  assert.deepEqual(
    entries.map(x => x.text),
    ['Dashboard', 'Présence', 'Classes & Groupes', 'Emploi du temps', 'Étudiants', 'Séances', 'Planning des séances', 'Rapports', 'Administration']
  );
  assert.deepEqual(
    entries.map(x => x.id),
    ['dashboard', 'presence', 'classes', 'emploi', 'etudiants', 'seances', 'planning-v16', 'rapports', 'administration']
  );
});

test('V16 planning is a native tab and the floating V5.15 launcher is absent', () => {
  assert.ok(html.includes('id="planning-v16" class="tab-content"'));
  assert.ok(html.includes("switchTab('planning-v16')"));
  assert.equal(html.includes('Planning V5.15'), false);
  assert.equal(html.includes('v515-launcher'), false);
});
