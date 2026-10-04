const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');

// Other regression tests also generate web/index.html: isolate this build.
function buildPagesCandidate() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fst-notices-'));
  try {
    fs.mkdirSync(path.join(dir, 'web'));
    fs.cpSync('scripts', path.join(dir, 'scripts'), {recursive: true});
    fs.cpSync('shared', path.join(dir, 'shared'), {recursive: true});
    fs.copyFileSync('index.html', path.join(dir, 'index.html'));
    cp.execFileSync('python', ['scripts/build_pages_from_41881.py'], {cwd: dir, stdio: 'pipe'});
    return fs.readFileSync(path.join(dir, 'web', 'index.html'), 'utf8');
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
}

const html = buildPagesCandidate();

test('generated Pages official notices heading has no application version suffix', () => {
  const heading = /Avis\s+officiels\s*(?:\u2014|\u2013|-|&mdash;|&ndash;)\s*(?:V\s*\d+(?:\.\d+)*|Version\s+\d+(?:\.\d+)*)/gi;
  const matches = [...html.matchAll(heading)];
  const excerpts = matches.map(m => html.slice(Math.max(0, m.index - 160), m.index + m[0].length + 160));
  assert.equal(matches.length, 0, 'Version remains in generated notices heading: ' + JSON.stringify(excerpts));
  assert.match(html, /<h3><i class="fas fa-bullhorn"><\/i> Avis officiels<\/h3>/);
});

test('removing the notices version preserves the icon and all official notice content', () => {
  const source = fs.readFileSync('index.html', 'utf8').replace(/\r\n/g, '\n');
  const section = /<section\b[^>]*\bid="v21-official-notices"[^>]*>[\s\S]*?<\/section>/;
  const original = source.match(section);
  const delivered = html.replace(/\r\n/g, '\n').match(section);
  assert.ok(original, 'Original official notices block must exist');
  assert.ok(delivered, 'Delivered official notices block must not be removed');
  assert.equal(delivered[0], original[0].replace('Avis officiels \u2014 V30</h3>', 'Avis officiels</h3>'));
});

test('browser title retains the institution and academic year without an app version', () => {
  const title = html.match(/<title>([^<]*)<\/title>/i);
  assert.ok(title, 'Browser title is required');
  assert.equal(title[1], 'Gestion Présence FST — 2026/2027');
});

test('main application heading has no version suffix', () => {
  assert.match(html, /<h1><i class="fas fa-users"><\/i> Gestion de Présence des TP<\/h1>/);
  assert.doesNotMatch(html, /Gestion de Présence des TP\s*[—–-]\s*V\d/i);
});

for (const label of ['Étudiants', 'Séances', 'Planning des séances', 'Configuration des intervenants']) {
  test('static and dynamically generated ' + label + ' labels have no version suffix', () => {
    assert.ok(html.includes(label), 'The section must remain available');
    // Search the complete payload, including inline templates and textContent assignments.
    assert.equal(html.includes(label + ' — V30'), false, 'Legacy label remains in a template');
    assert.equal(html.includes(label + ' — V31'), false, 'Do not rename the version');
  });
}

test('teachers source notice has no visible version', () => {
  assert.ok(html.includes('Source officielle :</strong>'));
  assert.doesNotMatch(html, /Source officielle\s+V\d/i);
});

test('all delivered heading text is version-free including inline HTML templates', () => {
  const headings = [...html.matchAll(/<(h[1-6]|title)\b[^>]*>([\s\S]*?)<\/\1>/gi)];
  assert.ok(headings.length > 10, 'Scan the full interface, not one sample heading');
  for (const match of headings) {
    const text = match[2].replace(/<[^>]*>/g, '');
    assert.doesNotMatch(text, /\b(?:V\s*\d+(?:\.\d+)*|Version\s+\d+(?:\.\d+)*)\b/i, text);
  }
});

test('removing visible versions preserves logos, institution, year and technical module identifiers', () => {
  const source = fs.readFileSync('index.html', 'utf8');
  assert.deepEqual([...html.matchAll(/<img\b[^>]*>/gi)].map(m => m[0]), [...source.matchAll(/<img\b[^>]*>/gi)].map(m => m[0]));
  assert.ok(html.includes('Faculté des Sciences de Tunis'));
  assert.ok(html.includes('Université de Tunis El Manar'));
  assert.ok(html.includes('2026/2027'));
  assert.ok(html.includes('data-app-version="V30"'), 'Technical metadata is not a visible label');
  assert.ok(html.includes('data-fst-v30-official-teachers="inline"'));
  assert.ok(html.includes('./v30-lpc3.js'));
  assert.ok(html.includes('./v31-domain.js'));
});
