const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const workflowPath = path.join(__dirname, '../../.github/workflows/deploy-pages.yml');

test('V16 GitHub Pages deployment is main-only and rebuilds the approved frontend', () => {
  assert.equal(fs.existsSync(workflowPath), true, 'deploy-pages.yml must exist');
  const yml = fs.readFileSync(workflowPath, 'utf8');
  assert.match(yml, /branches:\s*\[\s*main\s*\]/);
  assert.match(yml, /python scripts\/build_online_web\.py/);
  assert.match(yml, /node "\$test"/);
  assert.match(yml, /pages:\s*write/);
  assert.match(yml, /id-token:\s*write/);
  assert.match(yml, /actions\/upload-pages-artifact@v\d+/);
  assert.match(yml, /actions\/deploy-pages@v\d+/);
  assert.match(yml, /path:\s*web/);
});

test('Pages verifies the real online multi-file payload rather than standalone inline markers', () => {
  const yml = fs.readFileSync(workflowPath, 'utf8');
  assert.match(yml, /\.\/security-v2\.js/);
  assert.match(yml, /\.\/v16-planning-data\.js/);
  assert.match(yml, /\.\/v16-planning-ui\.js/);
  assert.match(yml, /save_attendance_sheet[^\n]*web\/security-v2\.js/);
  assert.match(yml, /challengeAndVerify[^\n]*web\/security-v2\.js/);
  assert.doesNotMatch(yml, /data-fst-security-v2=\\?"inline\\?"/);
});
