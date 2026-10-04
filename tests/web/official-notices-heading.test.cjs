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
