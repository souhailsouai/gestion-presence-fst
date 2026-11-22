const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const cp = require('node:child_process');

function buildV16() {
  cp.execFileSync('python', ['scripts/build_pages_from_41881.py'], {stdio: 'pipe'});
  return fs.readFileSync('web/index.html', 'utf8');
}

const {navEntries,NAV_IDS,NAV_LABELS}=require('./fst-shell-test-helpers.cjs');

test('delivered navigation follows the approved shared sidebar order', () => {
  const html = buildV16();
  const entries = navEntries(html);
  assert.deepEqual(
    entries.map(x => x.text),
    NAV_LABELS
  );
  assert.deepEqual(
    entries.map(x => x.id),
    NAV_IDS
  );
});

test('V16 planning is a native delivered tab and the floating V5.15 launcher is absent', () => {
  const html = buildV16();
  assert.ok(html.includes('id="planning-v16" class="tab-content"'));
  assert.ok(html.includes("switchTab('planning-v16')"));
  assert.equal(html.includes('Planning V5.15'), false);
  assert.equal(html.includes('v515-launcher'), false);
});

test('mobile drawer reuses the single sidebar and exposes Planning des seances', () => {
  const html = buildV16();
  const entries = navEntries(html);
  assert.deepEqual(entries.filter(x => x.id === 'planning-v16').map(x => x.text), ['Planning des s\u00e9ances']);
  assert.equal((html.match(/id="fst-sidebar-nav"/g)||[]).length, 1);
  assert.match(html, /aria-controls="fst-sidebar"/);
  assert.doesNotMatch(html, /<script[^>]*(?:data-shared-mobile-v2="js"|data-fst-mobile-js="inline")/);
});
